import type { Metadata } from 'next'
import { AdminTwoFactorForm } from '@/components/auth/admin-two-factor-form'

export const metadata: Metadata = {
  title: 'Verify sign-in',
  description: 'Enter the code we emailed you to finish signing in.',
}

export default function AdminTwoFactorPage() {
  return (
    <main className="bg-background flex min-h-[calc(100vh-72px)] w-full items-center justify-center px-5 py-12 md:px-8">
      <div className="flex w-full max-w-120 flex-col">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-heading text-foreground text-4xl leading-none font-extrabold tracking-tight md:text-[56px]">
            Verify it&apos;s you
          </h1>
          <p className="text-muted-foreground text-base leading-6 md:text-lg">
            We emailed you a 6-digit code. Enter it to finish signing in.
          </p>
        </header>

        <div className="mt-12 md:mt-14">
          <AdminTwoFactorForm />
        </div>
      </div>
    </main>
  )
}
