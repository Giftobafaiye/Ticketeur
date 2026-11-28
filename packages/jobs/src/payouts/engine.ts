import type { Database } from '@ticketur/db'
import {
  applyTransferFacts,
  claimApprovedPayout,
  failTransferAttempt,
  findAttemptByReference,
  formatNaira,
  loadInFlightTransfers,
  loadPayout,
  loadStaleApprovedPayoutIds,
  noteApprovedPayout,
  noteTransferAttempt,
  type PayoutRow,
} from '@ticketur/db/payouts'

import {
  createTransfer,
  findTransferByReference,
  getNgnBalance,
  getTransfer,
  isTestSecretKey,
  transferState,
  type CallOptions,
  type FlutterwaveTransfer,
  type TransferLookup,
} from '../utils/flutterwave-transfers'

// Sending approved payouts as Flutterwave transfers, and settling them.
// Used by three tasks (execute-payout, settle-payout-transfer,
// reconcile-payouts). The SQL lives in @ticketur/db/payouts/transfers.ts;
// this file is the sequence around the Flutterwave calls, written against
// injected Flutterwave options and a notifier so it can be exercised against a
// real database with Flutterwave answered in-process.
//
// ── The sequence that makes double payment impossible ──
//   1. CLAIM, in one transaction under the payout's row lock: still
//      'approved', the balance still covers it, write the attempt row with
//      its deterministic reference (status 'unconfirmed'), move the payout
//      to 'processing'. Two runs racing for one payout serialise there and
//      the second finds it no longer approved.
//   2. SEND, outside any transaction (a network call must never hold locks).
//   3. RECORD Flutterwave's answer:
//        accepted            → the attempt carries Flutterwave's id; settle
//                              now if it is already final
//        duplicate_reference → it DID arrive earlier: look it up, never resend
//        refused             → nothing was created: attempt and payout failed
//        ambiguous           → stays 'unconfirmed'; the sweep looks it up
//   A payout in 'processing' is finished only by Flutterwave's answer, or by
//   an admin confirming what the Flutterwave dashboard shows. Nothing here
//   ever sends the same attempt twice, and nothing retries an unknown.

export type Notify = (
  kind: 'paid' | 'failed',
  payout: PayoutRow,
  extra: { reference?: string; reason?: string }
) => Promise<void>

export type EngineDeps = {
  db: Database
  fw: CallOptions
  notify: Notify
  now?: () => Date
}

const clock = (deps: EngineDeps) => (deps.now ? deps.now() : new Date())

/** "Ticketeur payout ab12cd34" — what the organizer sees on their statement. */
function narrationFor(payoutId: string): string {
  return `Ticketeur payout ${payoutId.replace(/[^A-Za-z0-9]/g, '').slice(-8)}`
}

function describeLookup(lookup: TransferLookup): string {
  switch (lookup.kind) {
    case 'found':
      return `found (${lookup.transfer.status})`
    case 'none':
      return 'Flutterwave has no such transfer'
    case 'unauthorized':
      return `refused (HTTP ${lookup.httpStatus})`
    case 'unavailable':
      return `unavailable (${lookup.reason})`
  }
}

export type SendResult =
  | { kind: 'skipped'; reason: string }
  | { kind: 'waiting_for_funds'; availableMinor: number }
  | { kind: 'held'; reason: string }
  | { kind: 'sent'; state: 'pending' | 'successful' | 'failed' | 'unconfirmed' }
  | { kind: 'refused'; message: string }

/** Send one approved payout. Safe to call twice: the second finds it claimed. */
export async function sendApprovedPayout(
  deps: EngineDeps,
  payoutId: string
): Promise<SendResult> {
  const current = await loadPayout(deps.db, payoutId)
  if (!current) return { kind: 'skipped', reason: 'not found' }
  if (current.status !== 'approved') {
    return { kind: 'skipped', reason: `status is ${current.status}` }
  }

  // Before claiming: a short Flutterwave balance leaves the payout approved,
  // to be sent by a later sweep, instead of spending an attempt on a refusal.
  // A balance we cannot read is no reason to wait — Flutterwave refusing for
  // want of funds is a definite, safe outcome anyway.
  const balance = await getNgnBalance(deps.fw)
  if (balance.kind === 'found' && balance.availableMinor < current.amountMinor) {
    await noteApprovedPayout(
      deps.db,
      payoutId,
      `Waiting for the Flutterwave balance: ${formatNaira(balance.availableMinor)} available, ${formatNaira(current.amountMinor)} needed.`,
      clock(deps)
    )
    return { kind: 'waiting_for_funds', availableMinor: balance.availableMinor }
  }

  const claim = await claimApprovedPayout(deps.db, {
    payoutId,
    testMode: isTestSecretKey(deps.fw.secretKey),
    now: clock(deps),
  })
  if (claim.kind === 'gone') return { kind: 'skipped', reason: 'no longer approved' }
  if (claim.kind === 'held') {
    return { kind: 'held', reason: 'balance no longer covers it' }
  }

  const { payout, transfer } = claim
  const outcome = await createTransfer(
    {
      reference: transfer.reference,
      bankCode: payout.bankCode,
      accountNumber: payout.accountNumber,
      amountMinor: payout.amountMinor,
      narration: narrationFor(payout.id),
    },
    deps.fw
  )

  switch (outcome.kind) {
    case 'accepted':
      return {
        kind: 'sent',
        state: await applyTransfer(deps, transfer.id, outcome.transfer),
      }
    case 'duplicate_reference': {
      const found = await findTransferByReference(transfer.reference, deps.fw)
      if (found.kind === 'found') {
        return {
          kind: 'sent',
          state: await applyTransfer(deps, transfer.id, found.transfer),
        }
      }
      await noteTransferAttempt(
        deps.db,
        transfer.id,
        `Flutterwave says this reference was used, but the lookup said: ${describeLookup(found)}`,
        clock(deps)
      )
      return { kind: 'sent', state: 'unconfirmed' }
    }
    case 'refused': {
      // Nothing was created. Platform-side causes (IP whitelist, balance,
      // key) are the admin's to fix, so the organizer is not alarmed by an
      // email; the payout lands in the admin's queue as failed.
      await failTransferAttempt(deps.db, transfer.id, outcome.message, clock(deps))
      return { kind: 'refused', message: outcome.message }
    }
    case 'ambiguous':
      await noteTransferAttempt(
        deps.db,
        transfer.id,
        `No clear answer from Flutterwave: ${outcome.reason}`,
        clock(deps)
      )
      return { kind: 'sent', state: 'unconfirmed' }
  }
}

/**
 * Apply what Flutterwave says about a transfer, and tell the organizer if
 * that finished their payout — exactly once, however many times the same
 * answer arrives.
 */
export async function applyTransfer(
  deps: EngineDeps,
  transferRowId: string,
  t: FlutterwaveTransfer
): Promise<'pending' | 'successful' | 'failed'> {
  const state = transferState(t.status)
  const result = await applyTransferFacts(
    deps.db,
    transferRowId,
    {
      reference: t.reference,
      flwTransferId: t.id,
      state,
      feeMinor: t.feeMinor,
      completeMessage: t.completeMessage,
      requiresApproval: t.requiresApproval,
      raw: { ...t },
    },
    clock(deps)
  )
  if (result?.orphanedSuccess) {
    // Money left for a payout that is no longer in flight — an admin marked
    // it "not sent" and it was sent again, or similar. Loud: it may be a
    // double payment someone has to recover.
    console.error('[payouts] SUCCESSFUL transfer for a payout that is not processing', {
      reference: result.reference,
      flwTransferId: t.id,
    })
  }
  if (result?.payout) {
    await deps.notify(state === 'successful' ? 'paid' : 'failed', result.payout, {
      reference: result.reference,
      reason: t.completeMessage,
    })
  }
  const settled = result?.state ?? state
  return settled === 'unconfirmed' ? 'pending' : settled
}

/**
 * Settle one transfer Flutterwave told us about (the webhook). Re-fetches it
 * first: a webhook body is a hint, not the record.
 */
export async function settleFromWebhook(
  deps: EngineDeps,
  args: { flwTransferId: string; reference: string }
): Promise<
  | { kind: 'unknown_reference' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'applied'; state: string }
> {
  const attempt = await findAttemptByReference(deps.db, args.reference)
  if (!attempt) return { kind: 'unknown_reference' }

  const lookup = await getTransfer(args.flwTransferId, deps.fw)
  if (lookup.kind !== 'found') {
    return { kind: 'unavailable', reason: describeLookup(lookup) }
  }
  if (lookup.transfer.reference !== attempt.reference) {
    return { kind: 'unknown_reference' }
  }
  return {
    kind: 'applied',
    state: await applyTransfer(deps, attempt.id, lookup.transfer),
  }
}

export type ReconcileSummary = {
  checked: number
  settled: number
  stillPending: number
  unconfirmed: number
  sent: number
  waiting: number
}

/**
 * The sweep. Finishes what is in flight (by Flutterwave id, or by our
 * reference when the create call never answered) and, unless told not to,
 * sends anything approved that the approval's own trigger did not reach.
 */
export async function reconcilePayouts(
  deps: EngineDeps,
  opts: {
    approvedGraceMs?: number
    limit?: number
    // Off outside `live` mode: in-flight transfers are still settled (money
    // already sent has to be recorded), but nothing new is sent.
    sendApproved?: boolean
  } = {}
): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    checked: 0,
    settled: 0,
    stillPending: 0,
    unconfirmed: 0,
    sent: 0,
    waiting: 0,
  }
  const limit = opts.limit ?? 50

  for (const transfer of await loadInFlightTransfers(deps.db, limit)) {
    summary.checked++
    const lookup = transfer.flwTransferId
      ? await getTransfer(transfer.flwTransferId, deps.fw)
      : await findTransferByReference(transfer.reference, deps.fw)
    if (lookup.kind === 'found') {
      const state = await applyTransfer(deps, transfer.id, lookup.transfer)
      if (state === 'pending') summary.stillPending++
      else summary.settled++
      continue
    }
    // Not found (or no answer) is NEVER read as "failed": an ambiguous
    // create may simply not be visible yet. It waits — for Flutterwave, or
    // for an admin to confirm what the dashboard shows.
    await noteTransferAttempt(
      deps.db,
      transfer.id,
      `Last check: ${describeLookup(lookup)}`,
      clock(deps)
    )
    if (transfer.status === 'unconfirmed') summary.unconfirmed++
    else summary.stillPending++
  }

  if (opts.sendApproved === false) return summary

  const grace = opts.approvedGraceMs ?? 2 * 60 * 1000
  const before = new Date(clock(deps).getTime() - grace)
  for (const id of await loadStaleApprovedPayoutIds(deps.db, before, limit)) {
    const result = await sendApprovedPayout(deps, id)
    if (result.kind === 'sent' || result.kind === 'refused') summary.sent++
    if (result.kind === 'waiting_for_funds') summary.waiting++
  }
  return summary
}
