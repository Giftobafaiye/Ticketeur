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

// POST handler for `/api/axiom`: the browser's ProxyTransport posts client
// logs here so the ingest token never reaches the client.
export const axiomProxyRouteHandler = createProxyRouteHandler(logger)
