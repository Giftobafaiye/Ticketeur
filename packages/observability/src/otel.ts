import { OTLPHttpJsonTraceExporter, registerOTel } from '@vercel/otel'

import { env } from '@ticketur/env/core'

// Registers the app's OpenTelemetry pipeline (the existing @vercel/otel setup)
// and, when Axiom is configured, ships traces to Axiom's OTLP endpoint.
//
// When AXIOM_TOKEN / AXIOM_DATASET are absent (local dev, CI builds with
// placeholder env) it falls back to the default registerOTel behaviour so
// nothing errors and no traces are sent anywhere unexpected.
export function registerOTelForAxiom(serviceName: string) {
  const token = env.AXIOM_TOKEN
  const dataset = env.AXIOM_DATASET

  if (!token || !dataset) {
    registerOTel({ serviceName })
    return
  }

  registerOTel({
    serviceName,
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: `https://${env.AXIOM_HOST}/v1/traces`,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Axiom-Dataset': dataset,
      },
    }),
  })
}
