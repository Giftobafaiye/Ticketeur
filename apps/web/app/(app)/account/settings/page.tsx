import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { AccountSettingsContent } from '@/components/sections/account/account-settings-content'
import { getServerTRPC, HydrateClient } from '@/lib/trpc-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Settings',
  description:
    'Email preferences and sign-in settings for your Ticketeur account.',
}

export default async function AccountSettingsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login?next=/account/settings')
  }
  const { trpc, queryClient } = await getServerTRPC()
  await queryClient.prefetchQuery(trpc.account.profile.get.queryOptions())
  return (
    <HydrateClient>
      <AccountSettingsContent />
    </HydrateClient>
  )
}
