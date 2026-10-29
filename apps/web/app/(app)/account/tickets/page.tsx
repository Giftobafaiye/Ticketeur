import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { MyTicketsContent } from '@/components/sections/account/my-tickets-content'
import { getServerTRPC, HydrateClient } from '@/lib/trpc-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My tickets',
  description: 'Tickets you’ve purchased on Ticketeur.',
}

export default async function MyTicketsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login?next=/account/tickets')
  }
  const { trpc, queryClient } = await getServerTRPC()
  await queryClient.prefetchQuery(trpc.account.tickets.list.queryOptions())
  return (
    <HydrateClient>
      <MyTicketsContent />
    </HydrateClient>
  )
}
