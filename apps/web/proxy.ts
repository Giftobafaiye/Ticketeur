import { NextResponse, type NextRequest } from 'next/server'

// Maintenance mode for the public site.
//
// Set MAINTENANCE_MODE=on (Vercel shared env, production) and redeploy:
// every page shows the maintenance page and the API answers 503, so nobody
// can start a payment. Set it back to off and redeploy to reopen.
//
// Still open while down, so payments already in progress finish cleanly:
//   /api/flutterwave/webhook  Flutterwave confirming charges and transfers
//   /checkout/return          buyers coming back from Flutterwave's page
//   /api/cron/*               the reconcile job (Trigger.dev)
//   /api/health               uptime checks
//
// The team can still use the site: open any page once with
// ?maintenance_bypass=<MAINTENANCE_BYPASS_TOKEN> and a cookie keeps that
// browser through for 12 hours.

const OPEN_PATHS = new Set([
  '/api/flutterwave/webhook',
  '/checkout/return',
  '/api/health',
])
const OPEN_PREFIXES = ['/api/cron/']

const BYPASS_PARAM = 'maintenance_bypass'
const BYPASS_COOKIE = 'tk_maintenance_bypass'

export function proxy(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== 'on') return NextResponse.next()

  const { pathname, searchParams } = request.nextUrl
  if (
    OPEN_PATHS.has(pathname) ||
    OPEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next()
  }

  const token = process.env.MAINTENANCE_BYPASS_TOKEN ?? ''
  if (token.length >= 16) {
    const offered = searchParams.get(BYPASS_PARAM)
    if (offered !== null && sameToken(offered, token)) {
      const clean = request.nextUrl.clone()
      clean.searchParams.delete(BYPASS_PARAM)
      const response = NextResponse.redirect(clean)
      response.cookies.set(BYPASS_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 12,
      })
      return response
    }
    const cookie = request.cookies.get(BYPASS_COOKIE)?.value
    if (cookie && sameToken(cookie, token)) return NextResponse.next()
  }

  // no-store so nothing caches the maintenance answer past the window;
  // 503 + Retry-After so search engines treat it as temporary.
  const headers = { 'Cache-Control': 'no-store', 'Retry-After': '1800' }
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        error: 'maintenance',
        message:
          'Ticketeur is down for scheduled maintenance. Please try again shortly.',
      },
      { status: 503, headers }
    )
  }
  return new NextResponse(MAINTENANCE_HTML, {
    status: 503,
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Constant-time, so the bypass token can't be guessed a character at a time.
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const config = {
  // Everything except Next's build output and files with an extension (the
  // logo, fonts, images, robots.txt): the maintenance page still loads its
  // logo, and nothing static is blocked.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)'],
}

// Self-contained on purpose: it renders even if the app itself is broken
// mid-migration. Only the logo comes from /public.
const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ticketeur · Back soon</title>
<style>
  :root { color-scheme: light; --ink: #1a0d42; --muted: #5b5375; --brand: #6633ff; --line: #e7e2f6; }
  * { box-sizing: border-box; margin: 0; }
  body {
    min-height: 100vh; min-height: 100dvh; display: grid; place-items: center;
    padding: 24px 16px; color: var(--ink);
    background: radial-gradient(1200px 600px at 50% -10%, #ece6ff 0%, #f8f6ff 45%, #ffffff 100%);
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main {
    width: 100%; max-width: 480px; text-align: center; background: #fff;
    border: 1px solid var(--line); border-radius: 24px; padding: 44px 32px 36px;
    box-shadow: 0 1px 2px rgba(26, 13, 66, .04), 0 24px 48px -12px rgba(26, 13, 66, .12);
  }
  .logo { height: 34px; width: auto; margin: 0 auto 28px; display: block; }
  .badge {
    display: inline-flex; align-items: center; gap: 8px; margin-bottom: 20px;
    padding: 6px 12px; border-radius: 999px; background: #f2edff; color: var(--brand);
    font-size: 13px; font-weight: 600; letter-spacing: .01em;
  }
  .badge::before {
    content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--brand);
    animation: pulse 1.6s ease-in-out infinite;
  }
  h1 { font-size: 30px; line-height: 1.15; letter-spacing: -.02em; margin-bottom: 12px; }
  p { color: var(--muted); }
  .note { margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 14px; }
  .note strong { color: var(--ink); font-weight: 600; }
  @keyframes pulse { 50% { opacity: .3; } }
  @media (prefers-reduced-motion: reduce) { .badge::before { animation: none; } }
  @media (max-width: 420px) { main { padding: 36px 22px 28px; } h1 { font-size: 26px; } }
</style>
</head>
<body>
<main>
  <img class="logo" src="/logo.svg" alt="Ticketeur">
  <div class="badge">Scheduled maintenance</div>
  <h1>We'll be right back</h1>
  <p>We're upgrading our payment system to serve you better. Ticketeur will be back online shortly, so please check again in a little while.</p>
  <p class="note"><strong>Already bought tickets?</strong> You don't need to do anything. Your tickets are safe, and your confirmation email will arrive as usual.</p>
</main>
</body>
</html>`
