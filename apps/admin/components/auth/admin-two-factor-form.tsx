'use client'

import Link from 'next/link'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@ticketur/ui/components/button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@ticketur/ui/components/input-otp'

import { authClient } from '@/lib/auth-client'

// Second step of an admin sign-in. The password step left a short-lived
// two-factor cookie and no session; a code emailed to the admin turns that
// into a session. Device trust is deliberately not offered: every admin
// sign-in asks for a fresh code.
export function AdminTwoFactorForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [sending, startSend] = useTransition()
  const [verifying, startVerify] = useTransition()
  const sentOnMount = useRef(false)

  function sendCode() {
    startSend(async () => {
      const { error } = await authClient.twoFactor.sendOtp()
      if (error) {
        toast.error('Could not send a code', {
          description:
            error.message ?? 'Your sign-in may have expired. Start again.',
        })
        return
      }
      toast.success('Code sent', {
        description: 'Check your email for a 6-digit code.',
      })
    })
  }

  useEffect(() => {
    if (sentOnMount.current) return
    sentOnMount.current = true
    sendCode()
  }, [])

  function verify(value: string) {
    startVerify(async () => {
      const { data, error } = await authClient.twoFactor.verifyOtp({
        code: value,
      })
      if (error) {
        toast.error('Invalid code', {
          description: error.message ?? 'Double-check the code and try again.',
        })
        setCode('')
        return
      }

      const role = (data as { user?: { role?: string | null } } | null)?.user
        ?.role
      if (role !== 'admin') {
        await authClient.signOut()
        toast.error('Not an admin account', {
          description: 'This dashboard is for platform administrators only.',
        })
        router.push('/sign-in')
        return
      }

      toast.success('Welcome back')
      router.push('/')
    })
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <InputOTP
        maxLength={6}
        value={code}
        onChange={(v) => {
          setCode(v)
          if (v.length === 6) verify(v)
        }}
        disabled={verifying}
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
          ))}
        </InputOTPGroup>
      </InputOTP>

      <Button
        type="button"
        variant="outline"
        size="xl"
        className="w-full"
        onClick={sendCode}
        disabled={sending || verifying}
      >
        {sending ? 'Sending…' : 'Send a new code'}
      </Button>

      <Link
        href="/sign-in"
        className="text-primary text-sm font-semibold hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  )
}
