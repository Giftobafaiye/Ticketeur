import { cn } from '@ticketur/ui/lib/utils'

import type { PayoutStatus } from '@ticketur/db'

// How a payout's status reads to an admin. More specific than the
// organizer's wording: "approved" here means "waiting for someone to send it"
// in manual mode, which is a job, not a state of mind.
export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  pending_review: 'Needs review',
  approved: 'Approved — to send',
  processing: 'Sending',
  paid: 'Paid',
  failed: 'Transfer failed',
  rejected: 'Rejected',
  cancelled: 'Cancelled by organizer',
}

const TONE: Record<PayoutStatus, string> = {
  pending_review:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  approved: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  processing: 'bg-primary/10 text-primary',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  rejected: 'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONE[status]
      )}
    >
      {PAYOUT_STATUS_LABEL[status]}
    </span>
  )
}
