// Runs after the HTML loads but before React hydrates. Keep it fast — Next.js
// warns in dev if init is slower than ~16ms.
import { reportClientError } from '@ticketur/observability/client'

try {
  performance.mark('app-init')

  window.addEventListener('error', (event) => {
    reportClientError(event.error ?? event.message, 'error')
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, 'unhandledrejection')
  })
} catch (err) {
  // Never let instrumentation crash the page.
  console.error('[web] instrumentation-client init failed', err)
}

export function onRouterTransitionStart(
  url: string,
  navigationType: 'push' | 'replace' | 'traverse'
) {
  try {
    performance.mark(`nav-start-${navigationType}-${url}`)
  } catch {
    // ignore
  }
}
