import type { Metadata } from 'next'

import { getSession } from '@/lib/auth'
import { VendorAnalyticsContent } from '@/components/vendor/analytics/analytics-content'

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Track your business performance on Ticketeur.',
}

type VendorUserExtras = {
  businessName?: string | null
}

export default async function VendorAnalyticsPage() {
  const session = await getSession()
  const u = (session?.user ?? {}) as unknown as VendorUserExtras
  const name = u.businessName ?? session?.user.name ?? 'Vendor'

  return <VendorAnalyticsContent vendorName={name} />
}
