import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { AccountProfileContent } from '@/components/sections/account/account-profile-content'
import { getServerTRPC, HydrateClient } from '@/lib/trpc-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your Ticketeur account.',
}

export default async function AccountProfilePage() {
  const session = await getSession()
  if (!session) {
    redirect('/login?next=/account')
  }
  const { trpc, queryClient } = await getServerTRPC()
  await queryClient.prefetchQuery(trpc.account.profile.get.queryOptions())
  return (
    <HydrateClient>
      <AccountProfileContent />
    </HydrateClient>
  )
}
