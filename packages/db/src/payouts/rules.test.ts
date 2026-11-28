import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { MIN_PAYOUT_MINOR, PAYOUT_HOLD_DAYS } from './constants'
import { formatNaira, maskAccountNumber, nameMatch } from './format'
import {
  isPayoutReference,
  transferReference,
  TEST_MODE_SUCCESS_SUFFIX,
} from './references'
import {
  addDays,
  isIsoDate,
  isReleased,
  lagosDate,
  releaseDateFor,
} from './release'
import {
  balanceCovers,
  summariseBalance,
  wholeNaira,
  type EventEarnings,
} from './summary'
import { canTransition, isCommittedStatus, isOpenStatus } from './transitions'

describe('the rules themselves', () => {
  test('money releases the day after the event, minimum is ₦1,000', () => {
    assert.equal(PAYOUT_HOLD_DAYS, 1)
    assert.equal(MIN_PAYOUT_MINOR, 100_000)
  })
})

describe('dates', () => {
  test('isIsoDate accepts real dates only', () => {
    assert.equal(isIsoDate('2026-12-20'), true)
    assert.equal(isIsoDate('2026-02-29'), false)
    assert.equal(isIsoDate('2028-02-29'), true)
    assert.equal(isIsoDate('20/12/2026'), false)
    assert.equal(isIsoDate(null), false)
  })

  test('lagosDate is the Nigerian calendar date, an hour ahead of UTC', () => {
    // 23:30 UTC on the 20th is already the 21st in Lagos.
    assert.equal(lagosDate(new Date('2026-12-20T23:30:00Z')), '2026-12-21')
    assert.equal(lagosDate(new Date('2026-12-20T22:59:00Z')), '2026-12-20')
  })

  test('addDays crosses months and years', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01')
    assert.equal(addDays('2026-02-28', 1), '2026-03-01')
  })

  test('an event ending on the 20th releases on the 21st', () => {
    const release = releaseDateFor('2026-12-20')
    assert.equal(release, '2026-12-21')
    assert.equal(isReleased(release, '2026-12-20'), false)
    assert.equal(isReleased(release, '2026-12-21'), true)
    assert.equal(isReleased(release, '2027-01-05'), true)
  })

  test('an undated event never releases on its own', () => {
    assert.equal(releaseDateFor(null), null)
    assert.equal(releaseDateFor('TBD'), null)
    assert.equal(isReleased(null, '2099-01-01'), false)
  })
})

const VOICES: EventEarnings = {
  eventId: 'ev_voices',
  title: 'Voices Stage Play',
  lastDay: '2026-07-22',
  paidOrders: 25,
  earnedMinor: 12_400_000,
}
const EKO: EventEarnings = {
  eventId: 'ev_eko',
  title: 'EKO FASHION EXPERIENCE',
  lastDay: '2026-12-20',
  paidOrders: 54,
  earnedMinor: 7_760_000,
}

describe('summariseBalance', () => {
  test('ended events are available, upcoming ones are held', () => {
    const s = summariseBalance({
      events: [EKO, VOICES],
      payouts: [],
      adjustmentsMinor: 0,
      earlyRelease: false,
      today: '2026-11-28',
    })
    assert.equal(s.earnedMinor, 20_160_000)
    assert.equal(s.releasedMinor, 12_400_000)
    assert.equal(s.heldMinor, 7_760_000)
    assert.equal(s.availableMinor, 12_400_000)
    assert.equal(s.withdrawableMinor, 12_400_000)
    // Biggest first.
    assert.deepEqual(
      s.events.map((e) => [e.eventId, e.released]),
      [
        ['ev_voices', true],
        ['ev_eko', false],
      ]
    )
  })

  test('early release makes everything available, dated or not', () => {
    const s = summariseBalance({
      events: [EKO, { ...VOICES, lastDay: null }],
      payouts: [],
      adjustmentsMinor: 0,
      earlyRelease: true,
      today: '2026-11-28',
    })
    assert.equal(s.heldMinor, 0)
    assert.equal(s.availableMinor, 20_160_000)
  })

  test('open and paid payouts hold money; failed, rejected, cancelled release it', () => {
    const s = summariseBalance({
      events: [VOICES],
      payouts: [
        { status: 'paid', amountMinor: 5_000_000 },
        { status: 'pending_review', amountMinor: 1_000_000 },
        { status: 'approved', amountMinor: 0 },
        { status: 'processing', amountMinor: 500_000 },
        { status: 'failed', amountMinor: 9_999_900 },
        { status: 'rejected', amountMinor: 9_999_900 },
        { status: 'cancelled', amountMinor: 9_999_900 },
      ],
      adjustmentsMinor: 0,
      earlyRelease: false,
      today: '2026-11-28',
    })
    assert.equal(s.paidOutMinor, 5_000_000)
    assert.equal(s.inProgressMinor, 1_500_000)
    assert.equal(s.availableMinor, 12_400_000 - 5_000_000 - 1_500_000)
  })

  test('money paid outside the system comes off the balance', () => {
    const s = summariseBalance({
      events: [VOICES],
      payouts: [],
      adjustmentsMinor: -12_400_000,
      earlyRelease: false,
      today: '2026-11-28',
    })
    assert.equal(s.availableMinor, 0)
    assert.equal(s.withdrawableMinor, 0)
  })

  test('a balance can go negative, and nothing is then withdrawable', () => {
    const s = summariseBalance({
      events: [VOICES],
      payouts: [{ status: 'paid', amountMinor: 12_400_000 }],
      adjustmentsMinor: -500_000,
      earlyRelease: false,
      today: '2026-11-28',
    })
    assert.equal(s.availableMinor, -500_000)
    assert.equal(s.withdrawableMinor, 0)
  })

  test('withdrawable floors to whole naira', () => {
    const s = summariseBalance({
      events: [{ ...VOICES, earnedMinor: 1_234_567 }],
      payouts: [],
      adjustmentsMinor: 0,
      earlyRelease: false,
      today: '2026-11-28',
    })
    assert.equal(s.availableMinor, 1_234_567)
    assert.equal(s.withdrawableMinor, 1_234_500)
    assert.equal(wholeNaira(99), 0)
  })
})

describe('balanceCovers', () => {
  test('a pending payout is already inside the summary', () => {
    // Available is what is left AFTER the pending amount was taken off.
    assert.equal(balanceCovers({ availableMinor: 0 }, 500_000, true), true)
    assert.equal(balanceCovers({ availableMinor: -1 }, 500_000, true), false)
  })

  test('a failed payout being retried must fit on top', () => {
    assert.equal(balanceCovers({ availableMinor: 500_000 }, 500_000, false), true)
    assert.equal(balanceCovers({ availableMinor: 499_999 }, 500_000, false), false)
  })
})

describe('state machine', () => {
  test('the moves that are allowed', () => {
    assert.equal(canTransition('pending_review', 'approved'), true)
    assert.equal(canTransition('pending_review', 'cancelled'), true)
    assert.equal(canTransition('approved', 'processing'), true)
    assert.equal(canTransition('approved', 'paid'), true)
    assert.equal(canTransition('processing', 'paid'), true)
    assert.equal(canTransition('processing', 'failed'), true)
    assert.equal(canTransition('failed', 'approved'), true)
  })

  test('the moves that are not', () => {
    // An organizer cannot cancel once an admin has approved.
    assert.equal(canTransition('approved', 'cancelled'), false)
    // A payout in flight cannot be rejected or re-approved by hand.
    assert.equal(canTransition('processing', 'rejected'), false)
    assert.equal(canTransition('processing', 'approved'), false)
    // Terminal states stay terminal.
    for (const to of ['approved', 'processing', 'failed', 'rejected'] as const) {
      assert.equal(canTransition('paid', to), false)
      assert.equal(canTransition('rejected', to), false)
      assert.equal(canTransition('cancelled', to), false)
    }
  })

  test('open and committed', () => {
    assert.equal(isOpenStatus('processing'), true)
    assert.equal(isOpenStatus('paid'), false)
    assert.equal(isCommittedStatus('paid'), true)
    assert.equal(isCommittedStatus('failed'), false)
  })
})

describe('references and display', () => {
  test('a reference is deterministic per payout and attempt', () => {
    const id = 'pyt_3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
    assert.equal(
      transferReference(id, 1),
      'TKTP-3f2b1c4d5e6f4a7b8c9d0e1f2a3b4c5d-1'
    )
    assert.notEqual(transferReference(id, 1), transferReference(id, 2))
    assert.ok(transferReference(id, 1, { testMode: true }).endsWith(TEST_MODE_SUCCESS_SUFFIX))
    assert.ok(transferReference(id, 12, { testMode: true }).length < 50)
  })

  test('only our references are ours', () => {
    assert.equal(isPayoutReference('TKTP-abc-1'), true)
    assert.equal(isPayoutReference('TKTP-SPIKE-xyz-1_PMCKDU_1'), false)
    assert.equal(isPayoutReference('manual-dashboard-transfer'), false)
    assert.equal(isPayoutReference(42), false)
  })

  test('name match is a hint: match, partial, none', () => {
    assert.equal(nameMatch('OBAFAIYE GIFT ADEBAYO', ['Gift Obafaiye']), 'match')
    assert.equal(nameMatch('VOICES STAGE LTD', [null, 'Voices Stage']), 'match')
    assert.equal(nameMatch('ADA OBI', ['Ada']), 'match')
    assert.equal(nameMatch('ADA NWOSU', ['Ada Obi']), 'partial')
    assert.equal(nameMatch('JOHN DOE', ['Ada Obi', 'Luminaura Fashion']), 'none')
    // Corporate noise words do not count as a resemblance.
    assert.equal(nameMatch('XYZ VENTURES LTD', ['ABC Ventures Ltd']), 'none')
  })

  test('masking and naira formatting', () => {
    assert.equal(maskAccountNumber('0690000031'), '••••0031')
    assert.equal(formatNaira(12_400_000), '₦124,000')
    assert.equal(formatNaira(150_050), '₦1,500.50')
    assert.equal(formatNaira(-500_000), '−₦5,000')
  })
})
