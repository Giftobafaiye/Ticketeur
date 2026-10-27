'use client'

import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, LinkSquare02Icon } from '@hugeicons/core-free-icons'

import { Button } from '@ticketur/ui/components/button'

// The bar an organizer copies a public link from.
//
// Forms and contests each grew their own near-identical copy of this, and
// events had none at all — an organizer could build an event and then have no
// way to get its address out of the dashboard short of opening the public page
// and copying the browser's URL bar. One component now serves all three.
//
// `path` is kept relative so the code line stays short and readable; the
// absolute URL is assembled only at the moment of copying, from the origin the
// organizer is actually on, so a staging dashboard copies a staging link.
export function PublicLink({
  path,
  label = 'Share this link',
  labelIcon,
  note,
}: {
  path: string
  label?: string
  // Rendered before the label, as contests do for the voting icon.
  labelIcon?: ReactNode
  // A line under the bar for anything the organizer should know before
  // sharing — that the page says it is closed, say.
  note?: ReactNode
}) {
  async function copy() {
    const url =
      typeof window === 'undefined' ? path : `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      // Clipboard access is refused outside a secure context and in some
      // embedded browsers. Show the address so it can still be copied by hand
      // rather than failing silently.
      toast.error('Could not copy the link', { description: url })
    }
  }

  return (
    <div className="border-border/60 bg-background flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          {labelIcon}
          {label}
        </p>
        <code className="text-foreground truncate text-sm">{path}</code>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copy}
          className="gap-1.5"
        >
          <HugeiconsIcon
            icon={Copy01Icon}
            className="size-4"
            strokeWidth={1.8}
          />
          Copy
        </Button>
        <Button size="sm" variant="outline" asChild className="gap-1.5">
          <a href={path} target="_blank" rel="noreferrer">
            <HugeiconsIcon
              icon={LinkSquare02Icon}
              className="size-4"
              strokeWidth={1.8}
            />
            Open
          </a>
        </Button>
      </div>
      {note ? (
        <div className="text-muted-foreground flex w-full flex-col gap-1 text-xs">
          {note}
        </div>
      ) : null}
    </div>
  )
}
