'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  QrCodeScanIcon,
  CameraOffIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'

import { useTRPC } from '@/lib/trpc'
import { EventGuestList } from '@/components/dashboard/event-guest-list'

// The QR on a ticket encodes the attendee-facing URL (see ticketUrl() in
// packages/api/src/lib/tickets-pdf.ts): "<baseUrl>/tickets/code/<code>".
// Parse the code back out of whatever the camera reads; also accept a bare
// code in case one is ever typed/shared as plain text.
const BARE_CODE_PATTERN = /^[a-f0-9]{16,64}$/i

function extractTicketCode(raw: string): string | null {
  const trimmed = raw.trim()
  try {
    const url = new URL(trimmed)
    const match = /\/tickets\/code\/([^/?#]+)/.exec(url.pathname)
    if (match?.[1]) return match[1]
  } catch {
    // Not a URL — fall through to the bare-code check.
  }
  return BARE_CODE_PATTERN.test(trimmed) ? trimmed : null
}

type ScanResult =
  | { kind: 'checked-in'; name: string; tierName: string; repeat: boolean }
  | { kind: 'error'; message: string }

type CameraState = 'starting' | 'ready' | 'unsupported' | 'denied' | 'failed'

// Global augmentation: BarcodeDetector isn't in every TS lib.dom version yet.
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (
        source: CanvasImageSource
      ) => Promise<{ rawValue: string }[]>
    }
  }
}

export function EventCheckIn({ id }: { id: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data } = useQuery(trpc.org.events.byId.queryOptions({ id }))

  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraState, setCameraState] = useState<CameraState>('starting')
  const [result, setResult] = useState<ScanResult | null>(null)
  const lastScanRef = useRef<{ code: string; at: number } | null>(null)

  const checkIn = useMutation(
    trpc.org.events.setCheckedIn.mutationOptions({
      onSuccess: (res) => {
        setResult({
          kind: 'checked-in',
          name: res.name,
          tierName: res.tierName,
          repeat: !res.changed,
        })
        navigator.vibrate?.(res.changed ? 120 : [40, 60, 40])
        queryClient.invalidateQueries({
          queryKey: trpc.org.events.guests.queryKey({ eventId: id }),
          exact: false,
        })
      },
      onError: (e) => {
        setResult({ kind: 'error', message: e.message })
        navigator.vibrate?.([80, 60, 80])
      },
    })
  )

  const handleDetected = useCallback(
    (rawValue: string) => {
      const code = extractTicketCode(rawValue)
      if (!code) return
      const last = lastScanRef.current
      // Same code seen again within the cooldown (still in frame) — ignore.
      // A different code always goes through immediately.
      if (last && last.code === code && Date.now() - last.at < 3000) return
      lastScanRef.current = { code, at: Date.now() }
      checkIn.mutate({ code, checkedIn: true, eventId: id })
    },
    [checkIn, id]
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BarcodeDetector) {
      setCameraState('unsupported')
      return
    }

    let active = true
    let stream: MediaStream | null = null
    let frame: number | null = null
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })

    async function scanLoop() {
      if (!active || !videoRef.current) return
      try {
        const codes = await detector.detect(videoRef.current)
        if (codes[0]) handleDetected(codes[0].rawValue)
      } catch {
        // Transient decode errors between frames are expected — ignore.
      }
      if (active) frame = requestAnimationFrame(scanLoop)
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (!active || !videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraState('ready')
        scanLoop()
      } catch (err) {
        setCameraState(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'denied'
            : 'failed'
        )
      }
    }

    void start()
    return () => {
      active = false
      if (frame) cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [handleDetected])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 md:gap-8">
      <header className="flex shrink-0 flex-col gap-1.5">
        <Link
          href={`/org/events/${id}`}
          className="text-foreground hover:text-primary inline-flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            className="size-4"
            strokeWidth={2}
          />
          Back to event
        </Link>
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-[28px]">
          Check In{data ? ` — ${data.event.title}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Scan a ticket's QR code, or search below.
        </p>
      </header>

      <section className="border-border/60 bg-background flex shrink-0 flex-col items-center gap-4 rounded-2xl border p-5 md:p-6">
        <div className="bg-muted relative aspect-square w-full max-w-sm overflow-hidden rounded-xl">
          <video
            ref={videoRef}
            muted
            playsInline
            className={cn(
              'size-full object-cover',
              cameraState !== 'ready' && 'hidden'
            )}
          />
          {cameraState !== 'ready' ? (
            <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <HugeiconsIcon
                icon={
                  cameraState === 'starting' ? QrCodeScanIcon : CameraOffIcon
                }
                className="size-8"
                strokeWidth={1.5}
              />
              <p className="text-sm">
                {cameraState === 'starting'
                  ? 'Starting camera…'
                  : cameraState === 'unsupported'
                    ? "This browser can't scan QR codes here — use search below."
                    : cameraState === 'denied'
                      ? 'Camera access was denied. Allow it in your browser settings, or use search below.'
                      : "Couldn't start the camera — use search below."}
              </p>
            </div>
          ) : (
            <div
              aria-hidden
              className="border-primary/70 pointer-events-none absolute inset-8 rounded-2xl border-2"
            />
          )}
        </div>

        {result ? (
          <div
            className={cn(
              'flex w-full max-w-sm items-start gap-3 rounded-xl border p-4',
              result.kind === 'error'
                ? 'border-destructive/30 bg-destructive/5'
                : result.repeat
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-emerald-500/30 bg-emerald-500/5'
            )}
          >
            <HugeiconsIcon
              icon={
                result.kind === 'error'
                  ? AlertCircleIcon
                  : CheckmarkCircle02Icon
              }
              className={cn(
                'size-5 shrink-0',
                result.kind === 'error'
                  ? 'text-destructive'
                  : result.repeat
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
              )}
              strokeWidth={2}
            />
            <div className="flex flex-col">
              {result.kind === 'error' ? (
                <span className="text-foreground text-sm font-semibold">
                  {result.message}
                </span>
              ) : (
                <>
                  <span className="text-foreground text-sm font-semibold">
                    {result.repeat
                      ? 'Already checked in'
                      : 'Checked in'}{' '}
                    · {result.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {result.tierName}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <h2 className="font-heading text-foreground text-base font-bold tracking-tight md:text-lg">
          Guest List
        </h2>
        <EventGuestList eventId={id} />
      </section>
    </div>
  )
}
