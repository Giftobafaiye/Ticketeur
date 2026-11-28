import type { Metadata } from 'next'

import { OrgPayoutsContent } from '@/components/dashboard/payouts/org-payouts-content'

export const metadata: Metadata = {
  title: 'Payouts',
  description: 'What you have earned, and withdrawing it to your bank.',
}

export default function OrgPayoutsPage() {
  return <OrgPayoutsContent />
}
