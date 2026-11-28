'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import {
  NativeSelect,
  NativeSelectOption,
} from '@ticketur/ui/components/native-select'

import { useTRPC } from '@/lib/trpc'
import { CodeInput } from '@/components/dashboard/payouts/code-input'

// Adding (or changing) the account payouts go to, in two steps:
//   1. pick the bank, type the number — Flutterwave names the holder, and the
//      organizer checks it is them;
//   2. type the code we email them, which only works for this exact account.
// The name shown is Flutterwave's, and the server looks it up again when it
// saves, so nothing typed in the browser can change whose account it is.

type Step = 'details' | 'code'

export function BankAccountDialog({
  open,
  onOpenChange,
  replacing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  replacing: boolean
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('details')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [resolved, setResolved] = useState<{
    accountName: string
    bankName: string
  } | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [code, setCode] = useState('')

  const banks = useQuery({
    ...trpc.org.payouts.banks.queryOptions(),
    enabled: open,
    staleTime: 6 * 60 * 60 * 1000,
  })

  useEffect(() => {
    if (!open) return
    setStep('details')
    setBankCode('')
    setAccountNumber('')
    setResolved(null)
    setLookupError('')
    setCode('')
  }, [open])

  const resolve = useMutation(
    trpc.org.payouts.resolveAccount.mutationOptions({
      onSuccess: (res) => {
        setResolved({ accountName: res.accountName, bankName: res.bankName })
        setLookupError('')
      },
      onError: (err) => {
        setResolved(null)
        setLookupError(err.message)
      },
    })
  )
  const { mutate: lookUp } = resolve

  // Look the account up as soon as there is a bank and ten digits.
  useEffect(() => {
    setResolved(null)
    setLookupError('')
    if (bankCode && /^\d{10}$/.test(accountNumber)) {
      lookUp({ bankCode, accountNumber })
    }
  }, [bankCode, accountNumber, lookUp])

  const sendCode = useMutation(
    trpc.org.payouts.requestAccountCode.mutationOptions({
      onSuccess: () => {
        setStep('code')
        setCode('')
        toast.success('We emailed you a code')
      },
      onError: (err) =>
        toast.error('Could not send the code', { description: err.message }),
    })
  )

  const save = useMutation(
    trpc.org.payouts.saveAccount.mutationOptions({
      onSuccess: () => {
        toast.success('Bank account saved', {
          description:
            'For your security it can receive money 24 hours from now.',
        })
        void queryClient.invalidateQueries({
          queryKey: trpc.org.payouts.overview.queryKey(),
        })
        onOpenChange(false)
      },
      onError: (err) => {
        setCode('')
        toast.error('Could not save the account', { description: err.message })
      },
    })
  )

  function submitCode(value: string) {
    if (save.isPending) return
    save.mutate({ bankCode, accountNumber, code: value })
  }

  const busy = sendCode.isPending || save.isPending

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        {step === 'details' ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (resolved) sendCode.mutate({ bankCode, accountNumber })
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {replacing ? 'Change bank account' : 'Add bank account'}
              </DialogTitle>
              <DialogDescription>
                Your withdrawals are paid into this account. It must be yours
                or your business&apos;s.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <label className="text-foreground text-sm font-semibold">
                Bank
              </label>
              <NativeSelect
                className="w-full"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                disabled={banks.isLoading || busy}
              >
                <NativeSelectOption value="">
                  {banks.isLoading
                    ? 'Loading banks…'
                    : banks.isError
                      ? 'Banks unavailable — try again shortly'
                      : 'Choose your bank'}
                </NativeSelectOption>
                {(banks.data ?? []).map((b) => (
                  <NativeSelectOption key={b.code} value={b.code}>
                    {b.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-foreground text-sm font-semibold">
                Account number
              </label>
              <Input
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                value={accountNumber}
                onChange={(e) =>
                  setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))
                }
                placeholder="10-digit account number"
                disabled={busy}
              />
            </div>

            {resolve.isPending ? (
              <p className="text-muted-foreground text-sm">Checking the account…</p>
            ) : resolved ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Account name
                </p>
                <p className="text-foreground font-heading text-base font-semibold">
                  {resolved.accountName}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Only continue if this is you or your business.
                </p>
              </div>
            ) : lookupError ? (
              <p className="text-destructive text-sm">{lookupError}</p>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={!resolved || busy}>
                {sendCode.isPending ? 'Sending…' : 'Email me a code'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>Enter your code</DialogTitle>
              <DialogDescription>
                We emailed a 6-digit code to confirm{' '}
                <span className="text-foreground font-semibold">
                  {resolved?.bankName} ••••{accountNumber.slice(-4)} (
                  {resolved?.accountName})
                </span>
                . It expires in 10 minutes.
              </DialogDescription>
            </DialogHeader>
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={submitCode}
              disabled={save.isPending}
            />
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => sendCode.mutate({ bankCode, accountNumber })}
              >
                Send a new code
              </Button>
              <Button
                type="button"
                disabled={code.length !== 6 || save.isPending}
                onClick={() => submitCode(code)}
              >
                {save.isPending ? 'Saving…' : 'Save account'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
