import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'

import { cn } from '@ticketur/ui/lib/utils'

export type VendorStatTone = 'purple' | 'green' | 'blue' | 'orange' | 'red'

const toneStyles: Record<VendorStatTone, string> = {
  purple: 'bg-primary/10 text-primary',
  green:
    'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  blue: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  orange:
    'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
}

const pillTone: Record<VendorStatTone, string> = {
  purple: 'bg-primary/10 text-primary',
  green:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  orange:
    'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
}

export function VendorStatCard({
  label,
  value,
  icon,
  tone,
  pill,
  pillTone: pTone,
  progress,
  delta,
  href,
}: {
  label: string
  value: string
  icon: IconSvgElement
  tone: VendorStatTone
  pill?: string
  pillTone?: VendorStatTone
  progress?: number
  /** Period-over-period change, rendered as "+X% vs last period" when set. */
  delta?: number
  /** When set, the whole card becomes a link to this route. */
  href?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'flex size-9 items-center justify-center rounded-xl md:size-10',
            toneStyles[tone]
          )}
        >
          <HugeiconsIcon
            icon={icon}
            className="size-4 md:size-5"
            strokeWidth={1.8}
          />
        </div>
        {pill ? (
          <span
            className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
              pillTone[pTone ?? tone]
            )}
          >
            {pill}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs font-medium md:text-sm">
          {label}
        </p>
        <p className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-[28px]">
          {value}
        </p>
        {typeof progress === 'number' ? (
          <div className="bg-muted relative mt-2 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        ) : null}
        {typeof delta === 'number' ? (
          <p className="mt-0.5 text-[11px] font-medium md:text-xs">
            <span
              className={cn(
                'font-bold',
                delta >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {delta >= 0 ? '+' : ''}
              {delta}%
            </span>{' '}
            <span className="text-muted-foreground">vs last period</span>
          </p>
        ) : null}
      </div>
    </>
  )

  const shell =
    'border-border/60 bg-background flex flex-col gap-3 rounded-2xl border p-4 shadow-sm shadow-black/[0.02] md:p-5'

  if (!href) {
    return <div className={shell}>{body}</div>
  }

  // A stat card is not obviously clickable, so a linked one gets hover and
  // focus affordances. The card's own text (label + value) is the accessible
  // name, which reads as e.g. "Profile Incomplete 60%".
  return (
    <Link
      href={href}
      className={cn(
        shell,
        'hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-primary/50 transition-colors outline-none focus-visible:ring-2'
      )}
    >
      {body}
    </Link>
  )
}
