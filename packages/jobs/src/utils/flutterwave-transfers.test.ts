import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  classifyCreateTransfer,
  createTransfer,
  getNgnBalance,
  getTransfer,
  isTestSecretKey,
  parseTransfer,
  pickTransferByReference,
  transferState,
} from './flutterwave-transfers'

const TRANSFER = {
  id: 190626,
  account_number: '0690000040',
  bank_code: '044',
  full_name: 'Alexis Sanchez',
  created_at: '2026-11-28T10:00:00.000Z',
  currency: 'NGN',
  debit_currency: 'NGN',
  amount: 5500,
  fee: 26.875,
  status: 'NEW',
  reference: 'TKTP-abc-1',
  narration: 'Ticketeur payout abc',
  complete_message: '',
  requires_approval: 0,
  is_approved: 1,
  bank_name: 'ACCESS BANK NIGERIA',
}

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return { impl, calls }
}

describe('parseTransfer', () => {
  test('reads the fields we store, in kobo', () => {
    assert.deepEqual(parseTransfer(TRANSFER), {
      id: '190626',
      reference: 'TKTP-abc-1',
      status: 'NEW',
      amountMinor: 550_000,
      // 26.875 naira rounds to the nearest kobo.
      feeMinor: 2_688,
      currency: 'NGN',
      completeMessage: '',
      requiresApproval: false,
    })
  })

  test('is null without an id, a reference or a status', () => {
    assert.equal(parseTransfer({ ...TRANSFER, id: undefined }), null)
    assert.equal(parseTransfer({ ...TRANSFER, reference: '' }), null)
    assert.equal(parseTransfer({ ...TRANSFER, status: null }), null)
    assert.equal(parseTransfer('nope'), null)
  })

  test('notices a transfer held for dashboard approval', () => {
    assert.equal(
      parseTransfer({ ...TRANSFER, requires_approval: 1 })?.requiresApproval,
      true
    )
  })
})

describe('transferState', () => {
  test('only SUCCESSFUL is success and only FAILED is failure', () => {
    assert.equal(transferState('SUCCESSFUL'), 'successful')
    assert.equal(transferState('successful'), 'successful')
    assert.equal(transferState('FAILED'), 'failed')
    assert.equal(transferState('NEW'), 'pending')
    assert.equal(transferState('PENDING'), 'pending')
    // A word this code has never seen keeps the transfer in flight.
    assert.equal(transferState('REVERSED'), 'pending')
  })
})

describe('classifyCreateTransfer', () => {
  test('a successful body is accepted', () => {
    const outcome = classifyCreateTransfer(200, {
      status: 'success',
      message: 'Transfer Queued Successfully',
      data: TRANSFER,
    })
    assert.equal(outcome.kind, 'accepted')
  })

  test('a 200 we cannot read is ambiguous, never a refusal', () => {
    assert.equal(classifyCreateTransfer(200, null).kind, 'ambiguous')
    assert.equal(
      classifyCreateTransfer(200, { status: 'success', data: {} }).kind,
      'ambiguous'
    )
  })

  test('a 4xx is a refusal: nothing was created', () => {
    const outcome = classifyCreateTransfer(400, {
      status: 'error',
      message: 'Insufficient balance in wallet',
      data: null,
    })
    assert.deepEqual(outcome, {
      kind: 'refused',
      httpStatus: 400,
      message: 'Insufficient balance in wallet',
    })
    assert.equal(classifyCreateTransfer(401, {}).kind, 'refused')
    assert.equal(classifyCreateTransfer(403, {}).kind, 'refused')
    assert.equal(classifyCreateTransfer(429, {}).kind, 'refused')
  })

  test('a reused reference is recognised by message or by 409', () => {
    assert.equal(
      classifyCreateTransfer(400, {
        status: 'error',
        message: 'Transfer reference already exists',
      }).kind,
      'duplicate_reference'
    )
    assert.equal(
      classifyCreateTransfer(400, {
        status: 'error',
        message: 'Duplicate reference',
      }).kind,
      'duplicate_reference'
    )
    assert.equal(classifyCreateTransfer(409, {}).kind, 'duplicate_reference')
  })

  test("Flutterwave's real reused-reference answer is a duplicate, not a refusal", () => {
    // Verbatim from the Flutterwave sandbox, 2026-11-28.
    assert.equal(
      classifyCreateTransfer(400, {
        status: 'error',
        message: 'Payout with this ref already exists',
        data: null,
      }).kind,
      'duplicate_reference'
    )
  })

  test("the sandbox's other real 400s stay refusals", () => {
    for (const message of [
      'Please enable IP Whitelisting to access this service',
      'merchant is not enabled to make transfers.',
    ]) {
      assert.equal(
        classifyCreateTransfer(400, { status: 'error', message, data: null }).kind,
        'refused',
        message
      )
    }
  })

  test('5xx and 408 are ambiguous: the transfer may exist', () => {
    for (const status of [408, 500, 502, 503, 504]) {
      assert.equal(classifyCreateTransfer(status, {}).kind, 'ambiguous')
    }
  })
})

describe('pickTransferByReference', () => {
  test('finds an exact reference match', () => {
    const result = pickTransferByReference(
      200,
      { status: 'success', data: [{ ...TRANSFER, reference: 'other' }, TRANSFER] },
      'TKTP-abc-1'
    )
    assert.equal(result.kind, 'found')
  })

  test('an empty successful list is none', () => {
    assert.deepEqual(
      pickTransferByReference(200, { status: 'success', data: [] }, 'x'),
      { kind: 'none' }
    )
  })

  test('a list without ours proves nothing: unavailable, not none', () => {
    const result = pickTransferByReference(
      200,
      { status: 'success', data: [{ ...TRANSFER, reference: 'someone-else' }] },
      'TKTP-abc-1'
    )
    assert.equal(result.kind, 'unavailable')
  })

  test('a near match is not a match', () => {
    const result = pickTransferByReference(
      200,
      { status: 'success', data: [{ ...TRANSFER, reference: 'TKTP-abc-10' }] },
      'TKTP-abc-1'
    )
    assert.notEqual(result.kind, 'found')
  })
})

describe('createTransfer', () => {
  test('sends whole naira, NGN both ways, and our reference', async () => {
    const { impl, calls } = fakeFetch(200, {
      status: 'success',
      data: TRANSFER,
    })
    const outcome = await createTransfer(
      {
        reference: 'TKTP-abc-1',
        bankCode: '044',
        accountNumber: '0690000040',
        amountMinor: 550_000,
        narration: 'Ticketeur payout abc',
      },
      { secretKey: 'unit-test-key', fetchImpl: impl }
    )
    assert.equal(outcome.kind, 'accepted')
    assert.equal(calls[0]!.url, 'https://api.flutterwave.com/v3/transfers')
    assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), {
      account_bank: '044',
      account_number: '0690000040',
      amount: 5500,
      narration: 'Ticketeur payout abc',
      currency: 'NGN',
      debit_currency: 'NGN',
      reference: 'TKTP-abc-1',
    })
  })

  test('a thrown fetch is ambiguous: it may have reached Flutterwave', async () => {
    const impl = (async () => {
      throw new Error('socket hang up')
    }) as typeof fetch
    const outcome = await createTransfer(
      {
        reference: 'r',
        bankCode: '044',
        accountNumber: '0690000040',
        amountMinor: 100_000,
        narration: 'n',
      },
      { secretKey: 'unit-test-key', fetchImpl: impl }
    )
    assert.equal(outcome.kind, 'ambiguous')
  })

  test('no key is a refusal: nothing left this process', async () => {
    const { impl, calls } = fakeFetch(200, {})
    const outcome = await createTransfer(
      {
        reference: 'r',
        bankCode: '044',
        accountNumber: '0690000040',
        amountMinor: 100_000,
        narration: 'n',
      },
      { secretKey: undefined, fetchImpl: impl }
    )
    assert.equal(outcome.kind, 'refused')
    assert.equal(calls.length, 0)
  })
})

describe('lookups', () => {
  test('getTransfer: found, none on 404, unauthorized on 401', async () => {
    const found = await getTransfer('190626', {
      secretKey: 'k',
      fetchImpl: fakeFetch(200, { status: 'success', data: TRANSFER }).impl,
    })
    assert.equal(found.kind, 'found')
    const none = await getTransfer('1', {
      secretKey: 'k',
      fetchImpl: fakeFetch(404, { status: 'error' }).impl,
    })
    assert.equal(none.kind, 'none')
    const refused = await getTransfer('1', {
      secretKey: 'k',
      fetchImpl: fakeFetch(401, {}).impl,
    })
    assert.equal(refused.kind, 'unauthorized')
  })

  test('getNgnBalance reads the available balance in kobo', async () => {
    const result = await getNgnBalance({
      secretKey: 'k',
      fetchImpl: fakeFetch(200, {
        status: 'success',
        data: { currency: 'NGN', available_balance: 125000.5, ledger_balance: 130000 },
      }).impl,
    })
    assert.deepEqual(result, {
      kind: 'found',
      availableMinor: 12_500_050,
      ledgerMinor: 13_000_000,
    })
  })
})

test('isTestSecretKey recognises Flutterwave test keys only', () => {
  assert.equal(isTestSecretKey('FLWSECK_TEST-0000-X'), true)
  assert.equal(isTestSecretKey('FLWSECK-0000-X'), false)
  assert.equal(isTestSecretKey(undefined), false)
})
