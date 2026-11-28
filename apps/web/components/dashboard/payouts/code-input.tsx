'use client'

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@ticketur/ui/components/input-otp'

/** The six-digit emailed code, submitting itself once it is complete. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  onComplete: (value: string) => void
  disabled?: boolean
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={(v) => {
        const digits = v.replace(/\D/g, '')
        onChange(digits)
        if (digits.length === 6) onComplete(digits)
      }}
      disabled={disabled}
      autoFocus
      inputMode="numeric"
    >
      <InputOTPGroup className="gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className="size-11 rounded-xl border-[1.5px] text-lg font-semibold md:size-12 md:text-xl"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
