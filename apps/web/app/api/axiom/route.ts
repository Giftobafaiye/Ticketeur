// Receives client logs from the browser's ProxyTransport and forwards them to
// Axiom server-side, so the ingest token never reaches the client bundle.
export { axiomProxyRouteHandler as POST } from '@ticketur/observability/server'
