'use client'

import { Logger, ProxyTransport } from '@axiomhq/logging'
import { createUseLogger, createWebVitalsComponent } from '@axiomhq/react'
import { nextJsFormatters } from '@axiomhq/nextjs/client'

// Browser logger. It posts to our own `/api/axiom` proxy route rather than to
// Axiom directly, so the ingest token stays server-side (never shipped to the
// browser bundle).
const logger = new Logger({
  transports: [new ProxyTransport({ url: '/api/axiom', autoFlush: true })],
  formatters: nextJsFormatters,
})

// Hook for client components: `const log = useLogger(); log.info(...)`.
export const useLogger = createUseLogger(logger)

// Drop `<WebVitals />` into a root layout to stream Core Web Vitals to Axiom.
export const WebVitals = createWebVitalsComponent(logger)

// For non-React client code (e.g. the global handlers in
// instrumentation-client.ts) that can't use the `useLogger` hook.
export function reportClientError(error: unknown, source: string) {
  try {
    logger.error(`client ${source}`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      source,
    })
    void logger.flush()
  } catch {
    // Never let error reporting throw and break the page.
  }
}
