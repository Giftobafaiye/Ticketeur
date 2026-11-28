'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@ticketur/ui/components/button'
import { Input } from '@ticketur/ui/components/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ticketur/ui/components/dialog'
import { formatNaira } from '@ticketur/db/payouts/format'

import { useTRPC } from '@/lib/trpc'
import { CodeInput } from '@/components/dashboard/payouts/code-input'

// Asking for a withdrawal: choose the amount, then type the code we email,
// which only works for that exact amount to that exact account. The server
// re-checks everything — this form's checks are only there to say so sooner.

type Step = 'amount' | 'code'

export function WithdrawDialog({
  open,
  onOpenChange,
  withdrawableMinor,
  minPayoutMinor,
  account,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  withdrawableMinor: number
  minPayoutMinor: number
  account: { bankName: string; accountNumberMasked: string; accountName: string }
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('amount')
  const [amount, setAmount] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!open) return
    setStep('amount')
    setAmount('')
    setCode('')
  }, [open])

  const naira = Number(amount)
  const amountMinor = Number.isFinite(naira) ? Math.round(naira * 100) : 0
  const problem = !amount
    ? ''
    : !Number.isInteger(naira) || naira <= 0
      ? 'Enter a whole naira amount.'
      : amountMinor < minPayoutMinor
        ? `The smallest withdrawal is ${formatNaira(minPayoutMinor)}.`
        : amountMinor > withdrawableMinor
          ? `You can withdraw up to ${formatNaira(withdrawableMinor)}.`
          : ''

  const sendCode = useMutation(
    trpc.org.payouts.requestPayoutCode.mutationOptions({
      onSuccess: () => {
        setStep('code')
        setCode('')
        toast.success('We emailed you a code')
      },
      onError: (err) =>
        toast.error('Could not send the code', { description: err.message }),
    })
  )

  const request = useMutation(
    trpc.org.payouts.requestPayout.mutationOptions({
      onSuccess: () => {
        toast.success('Withdrawal requested', {
          description: "We'll email you as soon as it has been reviewed.",
        })
        void queryClient.invalidateQueries({
          queryKey: trpc.org.payouts.overview.queryKey(),
        })
        onOpenChange(false)
      },
      onError: (err) => {
        setCode('')
        toast.error('Could not request the withdrawal', {
          description: err.message,
        })
      },
    })
  )

  function submitCode(value: string) {
    if (request.isPending) return
    request.mutate({ amountMinor, code: value })
  }

  const busy = sendCode.isPending || request.isPending
  const accountLabel = `${account.bankName} ${account.accountNumberMasked} (${account.accountName})`

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        {step === 'amount' ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (amount && !problem) sendCode.mutate({ amountMinor })
            }}
          >
            <DialogHeader>
              <DialogTitle>Withdraw earnings</DialogTitle>
              <DialogDescription>
                To <span className="text-foreground font-semibold">{accountLabel}</span>.
                Our team reviews every withdrawal before it is sent.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <label className="text-foreground text-sm font-semibold">
                Amount (₦)
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(Math.floor(withdrawableMinor / 100))}
                disabled={busy}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  Available: {formatNaira(withdrawableMinor)} · minimum{' '}
                  {formatNaira(minPayoutMinor)}
                </span>
                <button
                  type="button"
                  className="text-primary font-semibold hover:underline"
                  onClick={() => setAmount(String(Math.floor(withdrawableMinor / 100)))}
                  disabled={busy}
                >
                  Withdraw all
                </button>
              </div>
              {problem ? <p className="text-destructive text-sm">{problem}</p> : null}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={!amount || Boolean(problem) || busy}>
                {sendCode.isPending ? 'Sending…' : 'Email me a code'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>Enter your code</DialogTitle>
              <DialogDescription>
                We emailed a 6-digit code to confirm withdrawing{' '}
                <span className="text-foreground font-semibold">
                  {formatNaira(amountMinor)}
                </span>{' '}
                to {accountLabel}. It expires in 10 minutes.
              </DialogDescription>
            </DialogHeader>
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={submitCode}
              disabled={request.isPending}
            />
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setStep('amount')}
              >
                Change amount
              </Button>
              <Button
                type="button"
                disabled={code.length !== 6 || request.isPending}
                onClick={() => submitCode(code)}
              >
                {request.isPending ? 'Requesting…' : 'Request withdrawal'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
