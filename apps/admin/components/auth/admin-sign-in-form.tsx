'use client'

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@ticketur/ui/components/field'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Input } from '@ticketur/ui/components/input'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@ticketur/ui/components/button'
import { ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons'

import { authClient } from '@/lib/auth-client'

const signInSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type SignInValues = z.infer<typeof signInSchema>

export function AdminSignInForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  })

  function onSubmit(data: SignInValues) {
    startTransition(async () => {
      const { data: result, error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      })

      if (error) {
        toast.error('Sign in failed', {
          description: error.message ?? 'Check your credentials and try again.',
        })
        return
      }

      if (result && 'twoFactorRedirect' in result && result.twoFactorRedirect) {
        router.push('/two-factor')
        return
      }

      // Every admin has two-factor sign-in on, so a password alone never ends
      // in a console session: reaching here means either not an admin, or an
      // admin whose 2FA was switched off behind the auth layer's back. The
      // console refuses both.
      const role = (result as { user?: { role?: string | null } } | null)?.user
        ?.role
      await authClient.signOut()
      toast.error(
        role === 'admin'
          ? 'Two-factor sign-in required'
          : 'Not an admin account',
        {
          description:
            role === 'admin'
              ? 'Re-run the admin seed script for your account, or contact support.'
              : 'This dashboard is for platform administrators only.',
        }
      )
    })
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          render={({ field: rhf, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel
                htmlFor={rhf.name}
                className="text-foreground text-base font-bold"
              >
                Admin Email Address
              </FieldLabel>
              <Input
                name={rhf.name}
                ref={rhf.ref}
                value={rhf.value ?? ''}
                onChange={rhf.onChange}
                onBlur={rhf.onBlur}
                id={rhf.name}
                type="email"
                placeholder="johndoe@example.com"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field: rhf, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <div className="flex items-center justify-between">
                <FieldLabel
                  htmlFor={rhf.name}
                  className="text-foreground text-base font-bold"
                >
                  Password
                </FieldLabel>
              </div>
              <div className="relative">
                <Input
                  name={rhf.name}
                  ref={rhf.ref}
                  value={rhf.value ?? ''}
                  onChange={rhf.onChange}
                  onBlur={rhf.onBlur}
                  id={rhf.name}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 transition-colors"
                >
                  <HugeiconsIcon
                    icon={showPassword ? ViewOffSlashIcon : ViewIcon}
                    className="size-5"
                    strokeWidth={1.8}
                  />
                </button>
              </div>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" size="xl" className="w-full" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  )
}
