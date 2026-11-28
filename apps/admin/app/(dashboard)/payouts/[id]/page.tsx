import type { Metadata } from 'next'

import { PayoutDetail } from '@/components/dashboard/payouts/payout-detail'

export const metadata: Metadata = {
  title: 'Payout',
}

export default async function PayoutDetailPage({
  params,
}: PageProps<'/payouts/[id]'>) {
  const { id } = await params

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 md:gap-8">
      <PayoutDetail id={id} />
    </div>
  )
}
