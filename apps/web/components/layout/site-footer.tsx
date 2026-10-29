'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  Facebook02Icon,
  InstagramIcon,
  NewTwitterIcon,
} from '@hugeicons/core-free-icons'

import { Button } from '@ticketur/ui/components/button'
import { LogoIcon } from '@ticketur/ui/icons/logo-icon'
import { currentYear } from '@/lib/date'

const DISCOVER_LINKS = [
  { href: '/events', label: 'Explore Events' },
  { href: '/vendors/list', label: 'Explore Vendors' },
] as const

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms/full', label: 'Terms & Conditions' },
] as const

const SOCIALS: {
  href: string
  label: string
  icon: IconSvgElement
}[] = [
  { href: 'https://facebook.com', label: 'Facebook', icon: Facebook02Icon },
  {
    href: 'https://www.instagram.com/ticketeur',
    label: 'Instagram',
    icon: InstagramIcon,
  },
  { href: 'https://x.com/ticketeur_', label: 'X', icon: NewTwitterIcon },
]

export function SiteFooter() {
  const year = currentYear()

  return (
    <footer className="border-border bg-background border-t">
      <div className="mx-auto w-full max-w-360 px-5 py-16 md:px-10 md:py-20">
        <div className="flex flex-col gap-20 md:flex-row md:items-start md:justify-between md:gap-12">
          <div className="flex max-w-104.25 flex-col gap-5.5">
            <Link
              href="/"
              aria-label="Ticketeur home"
              className="inline-flex items-center gap-2"
            >
              <LogoIcon className="h-10 w-auto" />
              <span className="font-heading text-foreground text-xl font-semibold tracking-tight md:text-[22px]">
                Ticketeur
              </span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The most secure marketplace for tickets sales for all kinds of
              events. Discover, buy, and sell with confidence.
            </p>
            <ul className="mt-1 flex items-center gap-4">
              {SOCIALS.map((social) => (
                <li key={social.label}>
                  <motion.a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    whileHover={{ y: -3, scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 20,
                    }}
                    className="hover:text-primary flex size-10 items-center justify-center rounded-lg bg-[#f1ebff] text-[#1a0d42] transition-colors"
                  >
                    <HugeiconsIcon
                      icon={social.icon}
                      className="size-5"
                      strokeWidth={1.8}
                    />
                  </motion.a>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col items-start gap-6 md:items-end">
            <h3 className="font-heading text-foreground text-base font-semibold">
              Discover
            </h3>
            <ul className="flex flex-col gap-4 md:items-end">
              {DISCOVER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Button size="xl" asChild className="mt-2">
              <Link href="/get-started">Get Started</Link>
            </Button>
          </div>
        </div>

        <div className="border-border mt-10 flex flex-col items-center gap-4 border-t pt-8 md:mt-12 md:flex-row md:justify-between md:gap-6">
          <p className="text-muted-foreground text-center text-xs md:text-left">
            &copy; {year} Ticketeur Inc. All rights reserved.
          </p>
          <ul className="flex items-center gap-5">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted-foreground hover:text-primary text-xs transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
