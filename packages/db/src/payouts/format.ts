// Display helpers shared by both apps and the emails, so the same amount and
// the same masked account read identically everywhere.

/** "••••0031" — enough for the owner to recognise, not enough to copy. */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.trim()
  return digits.length <= 4 ? digits : `••••${digits.slice(-4)}`
}

// Words that say nothing about whose account it is.
const NAME_NOISE = new Set([
  'LTD',
  'LIMITED',
  'ENT',
  'ENTERPRISE',
  'ENTERPRISES',
  'NIG',
  'NIGERIA',
  'VENTURES',
  'GLOBAL',
  'SERVICES',
  'INTERNATIONAL',
  'AND',
  'THE',
  'OF',
  'CO',
  'INC',
  'PLC',
  'MR',
  'MRS',
  'MS',
  'MISS',
  'DR',
])

function nameTokens(value: string): Set<string> {
  return new Set(
    value
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !NAME_NOISE.has(t))
  )
}

export type NameMatch = 'match' | 'partial' | 'none'

/**
 * How well the name the bank holds for an account resembles the names the
 * organizer gave us — a HINT for the reviewer, never a gate. Business
 * accounts are often in a company name the profile does not use, so a
 * mismatch is a reason to look closer, not to refuse.
 *
 *   match    two words in common (or every word of a one-word name)
 *   partial  one word in common
 *   none     nothing in common
 */
export function nameMatch(
  accountName: string,
  candidates: (string | null | undefined)[]
): NameMatch {
  const account = nameTokens(accountName)
  let best: NameMatch = 'none'
  for (const candidate of candidates) {
    if (!candidate) continue
    const words = nameTokens(candidate)
    if (words.size === 0) continue
    let shared = 0
    for (const w of words) if (account.has(w)) shared++
    if (shared >= Math.min(2, words.size)) return 'match'
    if (shared >= 1) best = 'partial'
  }
  return best
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
