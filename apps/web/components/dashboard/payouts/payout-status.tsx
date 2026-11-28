import { cn } from '@ticketur/ui/lib/utils'

import type { PayoutStatus } from '@ticketur/db'

// How a payout's status reads to the organizer who asked for it.
export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  pending_review: 'In review',
  approved: 'Approved',
  processing: 'Sending',
  paid: 'Paid',
  failed: 'Failed',
  rejected: 'Declined',
  cancelled: 'Cancelled',
}

const TONE: Record<PayoutStatus, string> = {
  pending_review: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  approved: 'bg-primary/10 text-primary',
  processing: 'bg-primary/10 text-primary',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  failed: 'bg-destructive/10 text-destructive',
  rejected: 'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONE[status]
      )}
    >
      {PAYOUT_STATUS_LABEL[status]}
    </span>
  )
}
