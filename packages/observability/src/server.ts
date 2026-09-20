import { Axiom } from '@axiomhq/js'
import { AxiomJSTransport, ConsoleTransport, Logger } from '@axiomhq/logging'
import {
  createOnRequestError,
  createProxyRouteHandler,
  nextJsFormatters,
} from '@axiomhq/nextjs'
import type { Instrumentation } from 'next'

import { env } from '@ticketur/env/core'

function createServerLogger() {
  // Exactly one transport: Axiom when configured, otherwise the console (local
  // dev / CI) so nothing hits the network or errors.
  const transport =
    env.AXIOM_TOKEN && env.AXIOM_DATASET
      ? new AxiomJSTransport({
          axiom: new Axiom({ token: env.AXIOM_TOKEN }),
          dataset: env.AXIOM_DATASET,
        })
      : new ConsoleTransport()

  return new Logger({ transports: [transport], formatters: nextJsFormatters })
}

// Shared server logger. Constructed once at module load; makes no network
// calls until something is actually logged and flushed.
export const logger = createServerLogger()

// Slots into each app's instrumentation.ts `onRequestError` hook — captures
// server-side render/route errors with request context. The explicit
// annotation keeps the emitted declaration portable (the inferred type
// references a non-nameable internal Next type).
export const onRequestError: Instrumentation.onRequestError =
  createOnRequestError(logger)

// ---------------------------------------------------------------------------
// `/api/axiom` proxy guards
//
// The stock `@axiomhq/nextjs` handler forwards whatever JSON it receives into
// the Axiom dataset. Exposed on a public host with no checks it is an anonymous
// write path: a third party can inject fabricated records or flood the dataset
// and burn the ingest quota, poisoning the telemetry incidents are
// reconstructed from. The guards below keep the browser transport working while
// rejecting requests that are not same-origin page loads and bounding how much
// a single caller can push.
// ---------------------------------------------------------------------------

/** Largest accepted request body, in bytes. */
export const MAX_BODY_BYTES = 256 * 1024

/** Largest accepted number of log events in one batch. */
export const MAX_EVENTS_PER_BATCH = 500

/** Sliding-window length for the per-IP request limit. */
export const RATE_LIMIT_WINDOW_MS = 60 * 1000

/** Requests allowed per IP within one window. */
export const RATE_LIMIT_MAX_REQUESTS = 60

/** Cap on the rate-limiter table so a flood of distinct IPs cannot grow it unbounded. */
const RATE_LIMIT_MAX_TRACKED_CLIENTS = 10_000

export interface ProxyRateLimiter {
  allow(key: string): boolean
}

export type ProxyBatch =
  | { ok: true; events: unknown[] }
  | { ok: false; status: number; error: string }

function hostOf(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Whether the request originates from a page on the host that serves it.
 * Browsers set `Origin` on every non-GET/HEAD request, including same-origin
 * POSTs, so a legitimate `ProxyTransport` call always carries one.
 */
export function isSameOriginRequest(req: Request): boolean {
  const host =
    req.headers.get('host')?.toLowerCase() ??
    req.headers.get('x-forwarded-host')?.toLowerCase() ??
    null
  if (!host) return false

  const origin = hostOf(req.headers.get('origin'))
  if (origin) return origin === host

  // No Origin header: fall back to referer, if any (also same-origin only).
  return hostOf(req.headers.get('referer')) === host
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (!forwarded) return null
  const first = forwarded.split(',')[0]?.trim()
  return first || null
}

/**
 * Best-effort per-IP rate limit held in module memory. A serverless instance
 * reuses its memory across requests, so this bounds how fast one caller can
 * drive a single instance; it is not a global quota (that would need shared
 * storage the deployment does not provision).
 */
export function createProxyRateLimiter(
  max: number = RATE_LIMIT_MAX_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
  maxTrackedClients: number = RATE_LIMIT_MAX_TRACKED_CLIENTS,
  now: () => number = Date.now
): ProxyRateLimiter {
  const windows = new Map<string, { count: number; start: number }>()

  function prune(at: number) {
    for (const [key, entry] of windows) {
      if (at - entry.start >= windowMs) windows.delete(key)
    }
  }

  return {
    allow(key: string): boolean {
      const at = now()
      const current = windows.get(key)
      if (current && at - current.start < windowMs) {
        if (current.count >= max) return false
        current.count += 1
        return true
      }

      if (!current && windows.size >= maxTrackedClients) prune(at)
      windows.set(key, { count: 1, start: at })
      return true
    },
  }
}

/** Read and validate the request body, applying the size, shape and batch caps. */
export async function readAxiomProxyBatch(req: Request): Promise<ProxyBatch> {
  const declaredLength = Number(req.headers.get('content-length') ?? '')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'payload too large' }
  }

  // Read a clone so the caller can still hand the untouched request to the
  // stock handler once the batch validates.
  const raw = await req.clone().text()
  if (raw.length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'payload too large' }
  }

  let events: unknown
  try {
    events = JSON.parse(raw)
  } catch {
    return { ok: false, status: 400, error: 'invalid JSON body' }
  }

  if (!Array.isArray(events)) {
    return { ok: false, status: 400, error: 'expected an array of log events' }
  }
  if (events.length > MAX_EVENTS_PER_BATCH) {
    return { ok: false, status: 413, error: 'batch too large' }
  }

  return { ok: true, events }
}

/** Apply the origin and rate-limit guards. */
export function checkAxiomProxyRequest(
  req: Request,
  rateLimiter?: ProxyRateLimiter
): { ok: true } | { ok: false; status: number; error: string } {
  if (!isSameOriginRequest(req)) {
    return { ok: false, status: 403, error: 'cross-origin request rejected' }
  }

  const ip = clientIp(req)
  if (rateLimiter && ip && !rateLimiter.allow(ip)) {
    return { ok: false, status: 429, error: 'too many requests' }
  }

  return { ok: true }
}

// The stock handler, plus the guards that keep `/api/axiom` from being an
// anonymous write path into the Axiom dataset.
const forwardAxiomProxyBatch = createProxyRouteHandler(logger)
const axiomProxyRateLimiter = createProxyRateLimiter()

function rejectProxyRequest(status: number, error: string): Response {
  return new Response(JSON.stringify({ status: 'error', error }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// POST handler for `/api/axiom`: the browser's ProxyTransport posts client
// logs here so the ingest token never reaches the client.
export async function axiomProxyRouteHandler(req: Request): Promise<Response> {
  const verdict = checkAxiomProxyRequest(req, axiomProxyRateLimiter)
  if (!verdict.ok) return rejectProxyRequest(verdict.status, verdict.error)

  const batch = await readAxiomProxyBatch(req)
  if (!batch.ok) return rejectProxyRequest(batch.status, batch.error)

  // Hand the validated request to the stock handler, which parses the batch and
  // flushes it (attaching the Next.js client identifier) itself.
  return forwardAxiomProxyBatch(req)
}
