// Display helpers shared by both apps and the emails, so the same amount and
// the same masked account read identically everywhere.

/** "••••0031" — enough for the owner to recognise, not enough to copy. */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.trim()
  return digits.length <= 4 ? digits : `••••${digits.slice(-4)}`
}

/** Kobo as naira for people: ₦1,500 or ₦1,500.50. Negative keeps its sign. */
export function formatNaira(minor: number): string {
  const sign = minor < 0 ? '−' : ''
  const abs = Math.abs(minor)
  const major = (abs / 100).toLocaleString('en-NG', {
    minimumFractionDigits: abs % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${sign}₦${major}`
}
