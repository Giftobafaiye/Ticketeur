'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  AnimatePresence,
  motion,
  useScroll,
  useMotionValueEvent,
} from 'motion/react'
import { toast } from 'sonner'

import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'
import { LogoIcon } from '@ticketur/ui/icons/logo-icon'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@ticketur/ui/components/avatar'

import { ThemeToggle } from '@/components/misc/theme-toggle'
import { UserMenu, type UserMenuUser } from '@/components/layout/user-menu'
import { authClient } from '@/lib/auth-client'
import { getPostLoginPath } from '@/lib/post-login-redirect'

const NAV_LINKS = [
  { href: '/events', label: 'Find Events' },
  { href: '/vendors/list', label: 'Find Vendors' },
  { href: '/organizers', label: 'For Organizers' },
  { href: '/vendors', label: 'For Vendors' },
] as const

type NavHref = (typeof NAV_LINKS)[number]['href']

// Exactly one link is active per page. A plain prefix match lit up two at
// once under /vendors: "For Vendors" (/vendors) matched /vendors/list too, so
// the marketplace looked like it was both pages. The marketplace owns every
// vendor page (the list and each profile); "For Vendors" is only the pitch.
function activeNavHref(pathname: string): NavHref | null {
  if (pathname === '/vendors') return '/vendors'
  if (pathname.startsWith('/vendors/')) return '/vendors/list'
  for (const { href } of NAV_LINKS) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return href
  }
  return null
}

function isActivePath(pathname: string, href: NavHref) {
  return activeNavHref(pathname) === href
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
  return initials || '?'
}

export type SiteHeaderSession = {
  user: UserMenuUser
  role?: string | null
} | null

export function SiteHeader({
  session = null,
}: {
  session?: SiteHeaderSession
}) {
  const pathname = usePathname() ?? '/'
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { scrollY } = useScroll()

  const dashboardHref = session ? getPostLoginPath(session.role) : '/'
  const showDashboard = dashboardHref !== '/'

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 20)
  })

  useEffect(() => {
    if (mobileOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <>
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'sticky top-0 z-40 w-full border-b transition-[background-color,border-color,backdrop-filter] duration-300',
          scrolled && !mobileOpen
            ? 'border-border bg-background/75 backdrop-blur-md'
            : 'bg-background border-transparent'
        )}
      >
        <div className="mx-auto flex h-18 w-full max-w-360 items-center justify-between px-4 md:h-21 md:px-10">
          <Link
            href="/"
            aria-label="Ticketeur home"
            className="group flex items-center gap-2"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              whileHover={{ scale: 1.06, rotate: -3 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              <LogoIcon className="h-9 w-auto md:h-10" />
            </motion.div>
            <span className="font-heading text-foreground text-xl font-semibold tracking-tight md:text-[22px]">
              Ticketeur
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-8 md:flex lg:gap-12"
          >
            <ul className="flex items-center gap-6 lg:gap-12">
              {NAV_LINKS.map((link) => {
                const active = isActivePath(pathname, link.href)
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative inline-flex text-base font-medium transition-colors',
                        active
                          ? 'text-primary'
                          : 'text-foreground hover:text-primary'
                      )}
                    >
                      {link.label}
                      {active ? (
                        <motion.span
                          layoutId="site-nav-underline"
                          className="bg-primary pointer-events-none absolute -bottom-1 left-0 h-0.5 w-full rounded-full"
                          transition={{
                            type: 'spring',
                            stiffness: 420,
                            damping: 32,
                          }}
                        />
                      ) : (
                        <span className="bg-primary pointer-events-none absolute -bottom-1 left-0 h-0.5 w-0 rounded-full transition-[width] duration-300 ease-out group-hover:w-full" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <ThemeToggle />
            {session ? (
              <UserMenu
                user={session.user}
                dashboardHref={showDashboard ? dashboardHref : undefined}
              />
            ) : (
              <Button size="xl" asChild>
                <Link href="/get-started">Get Started</Link>
              </Button>
            )}
          </nav>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            {session ? (
              <Avatar className="border-border/60 size-9 border-2">
                {session.user.image ? (
                  <AvatarImage
                    src={session.user.image}
                    alt={session.user.name}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {getInitials(session.user.name)}
                </AvatarFallback>
              </Avatar>
            ) : null}
            <MenuToggle
              open={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            />
          </div>
        </div>
      </motion.header>

      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        pathname={pathname}
        session={session}
        dashboardHref={showDashboard ? dashboardHref : null}
      />
    </>
  )
}

function MenuToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      aria-expanded={open}
      animate={{
        opacity: open ? 0 : 1,
        scale: open ? 0.7 : 1,
        pointerEvents: open ? 'none' : 'auto',
      }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="focus-visible:ring-primary/40 relative -mr-2 flex size-10 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 md:hidden"
    >
      <span className="bg-foreground absolute left-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1.5 rounded-full" />
      <span className="bg-foreground absolute left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" />
      <span className="bg-foreground absolute left-1/2 h-0.5 w-6 -translate-x-1/2 translate-y-1.5 rounded-full" />
    </motion.button>
  )
}

function MobileMenu({
  open,
  onClose,
  pathname,
  session,
  dashboardHref,
}: {
  open: boolean
  onClose: () => void
  pathname: string
  session: SiteHeaderSession
  dashboardHref: string | null
}) {
  const router = useRouter()

  async function handleSignOut() {
    onClose()
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success('Signed out')
          router.push('/')
          router.refresh()
        },
        onError: (ctx) => {
          toast.error('Could not sign out', {
            description: ctx.error.message ?? 'Please try again.',
          })
        },
      },
    })
  }
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed inset-0 z-50 md:hidden"
        >
          <motion.div
            className="bg-background absolute inset-0"
            initial={{ clipPath: 'circle(0% at calc(100% - 36px) 40px)' }}
            animate={{ clipPath: 'circle(150% at calc(100% - 36px) 40px)' }}
            exit={{ clipPath: 'circle(0% at calc(100% - 36px) 40px)' }}
            transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
          />

          <div
            aria-hidden
            className="from-primary/10 via-primary/4 pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-linear-to-b to-transparent"
          />

          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, rotate: 90 }}
            transition={{
              delay: 0.35,
              type: 'spring',
              stiffness: 320,
              damping: 22,
            }}
            whileHover={{ scale: 1.08, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            className="border-border bg-background text-foreground hover:border-primary hover:text-primary focus-visible:ring-primary/40 absolute top-5 right-5 z-10 flex size-11 items-center justify-center rounded-full border shadow-sm transition-colors outline-none focus-visible:ring-2"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
              aria-hidden
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </motion.button>

          <div className="relative flex h-full flex-col px-6 pt-28 pb-10">
            <nav aria-label="Mobile primary" className="flex-1">
              <ul className="flex flex-col gap-2">
                {NAV_LINKS.map((link, i) => {
                  const active = isActivePath(pathname, link.href)
                  return (
                    <motion.li
                      key={link.href}
                      initial={{ opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{
                        delay: 0.18 + i * 0.07,
                        duration: 0.42,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="border-border/70 overflow-hidden border-b"
                    >
                      <Link
                        href={link.href}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className="group flex items-center justify-between py-5"
                      >
                        <span
                          className={cn(
                            'font-heading text-3xl font-medium tracking-tight transition-colors',
                            active
                              ? 'text-primary'
                              : 'text-foreground group-hover:text-primary'
                          )}
                        >
                          {link.label}
                        </span>
                        <motion.span
                          aria-hidden
                          className="text-primary text-2xl"
                          initial={{ x: -8, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{
                            delay: 0.3 + i * 0.07,
                            duration: 0.3,
                          }}
                        >
                          →
                        </motion.span>
                      </Link>
                    </motion.li>
                  )
                })}
              </ul>
            </nav>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{
                delay: 0.18 + NAV_LINKS.length * 0.07,
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-8 flex flex-col gap-4"
            >
              {session ? (
                <>
                  <div className="border-border/70 flex items-center gap-3 rounded-2xl border p-3">
                    <Avatar className="size-12 shrink-0">
                      {session.user.image ? (
                        <AvatarImage
                          src={session.user.image}
                          alt={session.user.name}
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getInitials(session.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-foreground truncate text-base font-semibold">
                        {session.user.name}
                      </span>
                      <span className="text-muted-foreground truncate text-sm">
                        {session.user.email}
                      </span>
                    </div>
                  </div>
                  {dashboardHref ? (
                    <Button size="xl" asChild className="w-full">
                      <Link href={dashboardHref} onClick={onClose}>
                        Dashboard
                      </Link>
                    </Button>
                  ) : null}
                  <Link
                    href="/account"
                    onClick={onClose}
                    className="border-border/70 hover:border-primary/60 text-foreground rounded-2xl border px-4 py-3 text-center font-medium transition-colors"
                  >
                    Profile
                  </Link>
                  <Button
                    type="button"
                    size="xl"
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
                    onClick={handleSignOut}
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Button size="xl" asChild className="w-full">
                    <Link href="/get-started" onClick={onClose}>
                      Get Started
                    </Link>
                  </Button>
                  <p className="text-muted-foreground text-center text-sm">
                    Already have an account?{' '}
                    <Link
                      href="/login"
                      onClick={onClose}
                      className="text-primary font-medium hover:underline"
                    >
                      Sign in
                    </Link>
                  </p>
                </>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
