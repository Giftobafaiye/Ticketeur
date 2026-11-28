// The payouts export, as CSV, built in the browser from admin.payouts.exportRows.

type ExportRow = {
  id: string
  requestedAt: Date
  organizerName: string
  organizerEmail: string
  amountMinor: number
  status: string
  method: string | null
  bankName: string
  accountNumber: string
  accountName: string
  reviewedByName: string
  paidAt: Date | null
  reference: string
  flwTransferId: string
  transferFeeMinor: number | null
}

/**
 * One CSV cell. Quoted when it holds a separator, and defused when it starts
 * like a spreadsheet formula (=, +, -, @): an organizer's name is their own
 * input, and this file is opened in Excel.
 */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const naira = (minor: number | null) =>
  minor === null ? '' : (minor / 100).toFixed(2)

const iso = (d: Date | null) => (d ? d.toISOString() : '')

export function payoutsCsv(rows: ExportRow[]): string {
  const header = [
    'Payout ID',
    'Requested at (UTC)',
    'Organizer',
    'Organizer email',
    'Amount (NGN)',
    'Status',
    'Paid by',
    'Bank',
    'Account number',
    'Account name',
    'Reviewed by',
    'Paid at (UTC)',
    'Reference',
    'Flutterwave transfer ID',
    'Transfer fee (NGN, paid by platform)',
  ]
  const lines = rows.map((r) =>
    [
      r.id,
      iso(r.requestedAt),
      r.organizerName,
      r.organizerEmail,
      naira(r.amountMinor),
      r.status,
      r.method === 'manual' ? 'hand' : r.method === 'transfer' ? 'transfer' : '',
      r.bankName,
      r.accountNumber,
      r.accountName,
      r.reviewedByName,
      iso(r.paidAt),
      r.reference,
      r.flwTransferId,
      naira(r.transferFeeMinor),
    ]
      .map(csvCell)
      .join(',')
  )
  return [header.map(csvCell).join(','), ...lines].join('\r\n')
}

/** Hand the browser a file to save. */
export function downloadCsv(filename: string, csv: string): void {
  // A BOM, so Excel reads the ₦ and any accented names as UTF-8.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
