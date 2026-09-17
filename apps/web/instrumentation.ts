import { registerOTelForAxiom } from '@ticketur/observability/otel'

export function register() {
  registerOTelForAxiom('ticketeur-web')
}

// Server-side render/route error capture → Axiom (console in dev / when Axiom
// is not configured). See @ticketur/observability/server.
export { onRequestError } from '@ticketur/observability/server'
