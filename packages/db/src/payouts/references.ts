import { randomUUID } from 'node:crypto'

// Ids and the transfer reference we send to Flutterwave.

/** A row id: `prefix_uuid`, the shape the rest of the schema uses. */
export function newPayoutRowId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

/** Every reference this platform sends starts with this. */
export const PAYOUT_REFERENCE_PREFIX = 'TKTP-'

/**
 * Appended in Flutterwave TEST mode only: test transfers are mocked, and the
 * reference suffix decides their outcome (developer.flutterwave.com/docs/
 * testing). This one succeeds after a minute, so an end-to-end test run
 * reaches 'paid' instead of sitting in PENDING forever.
 */
export const TEST_MODE_SUCCESS_SUFFIX = '_PMCKDU_1'

/**
 * The reference for one transfer attempt of one payout. Deterministic, so the
 * attempt row can be written BEFORE Flutterwave is called and an ambiguous
 * call can always be looked up afterwards. Distinct per attempt, so a retry
 * after a definite failure is never mistaken for the failed one.
 *
 * Letters, digits and hyphens only, and well under 50 characters with the
 * test suffix.
 */
export function transferReference(
  payoutId: string,
  attempt: number,
  opts: { testMode?: boolean } = {}
): string {
  const core = payoutId.replace(/^[a-z]+_/, '').replace(/[^A-Za-z0-9]/g, '')
  const base = `${PAYOUT_REFERENCE_PREFIX}${core}-${attempt}`
  return opts.testMode ? `${base}${TEST_MODE_SUCCESS_SUFFIX}` : base
}

/** Whether a transfer reference is one of ours (and not, say, a transfer an admin made by hand in the dashboard). */
export function isPayoutReference(reference: unknown): reference is string {
  return (
    typeof reference === 'string' &&
    reference.startsWith(PAYOUT_REFERENCE_PREFIX) &&
    !reference.startsWith(`${PAYOUT_REFERENCE_PREFIX}SPIKE-`)
  )
}
