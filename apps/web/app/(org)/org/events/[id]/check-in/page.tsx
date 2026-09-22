import type { Metadata } from 'next'

import { EventCheckIn } from '@/components/dashboard/event-check-in'

type RouteParams = Promise<{ id: string }>

export const metadata: Metadata = {
  title: 'Check In',
  description: 'Scan tickets and check in guests on Ticketeur.',
}

export default async function OrgEventCheckInPage({
  params,
}: {
  params: RouteParams
}) {
  const { id } = await params
  return <EventCheckIn id={id} />
}
