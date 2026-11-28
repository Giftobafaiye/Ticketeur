import type { Metadata } from 'next'

import { OrganizerPayoutsDetail } from '@/components/dashboard/payouts/organizer-payouts-detail'

export const metadata: Metadata = {
  title: 'Organizer balance',
}

export default async function OrganizerPayoutsPage({
  params,
}: PageProps<'/payouts/organizers/[organizerId]'>) {
  const { organizerId } = await params

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 md:gap-8">
      <OrganizerPayoutsDetail organizerId={organizerId} />
    </div>
  )
}
