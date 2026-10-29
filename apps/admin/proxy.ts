import { getSession } from './lib/auth'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/sign-in',
  '/two-factor',
  '/forgot-password',
  '/reset-password',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await getSession()
  // Only platform admins may enter the admin app. A signed-in non-admin is
  // treated exactly like a signed-out visitor here (no redirect loop: a
  // non-admin session simply never satisfies the authorized branch below).
  //
  // Two-factor sign-in is mandatory here. Every admin has it switched on (the
  // auth hook in @ticketur/auth enforces that), so an admin session without it
  // was produced by something that bypassed the hook, and is not let in.
  const authorized =
    session?.user?.role === 'admin' && session.user.twoFactorEnabled === true

  if (authorized && isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!authorized && !isPublicPath(pathname)) {
    const url = new URL('/sign-in', request.url)
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|logo.svg|sitemap.xml|robots.txt).*)',
  ],
}
