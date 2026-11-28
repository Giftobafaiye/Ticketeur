import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'

import {
  getBanksCached,
  normalizeAccountName,
  parseAccountResolution,
  parseBankList,
  resetBankListCache,
  resolveBankAccount,
} from './flutterwave-accounts'

// A fetch that answers with a fixed status and body, and records what it was
// asked. Nothing leaves the process.
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return { impl, calls }
}

describe('parseBankList', () => {
  test('reads code and name, de-duplicates by code, sorts by name', () => {
    const banks = parseBankList({
      status: 'success',
      data: [
        { id: 2, code: '058', name: 'Guaranty Trust Bank' },
        { id: 1, code: '044', name: 'Access Bank' },
        { id: 3, code: '044', name: 'Access Bank (duplicate)' },
        { id: 4, code: 50211, name: 'Kuda Bank' },
        { id: 5, code: '', name: 'No code' },
        { id: 6, code: '999' },
      ],
    })
    assert.deepEqual(banks, [
      { code: '044', name: 'Access Bank' },
      { code: '058', name: 'Guaranty Trust Bank' },
      { code: '50211', name: 'Kuda Bank' },
    ])
  })

  test('is null for anything that is not a successful list', () => {
    assert.equal(parseBankList(null), null)
    assert.equal(parseBankList({ status: 'error', data: [] }), null)
    assert.equal(parseBankList({ status: 'success', data: {} }), null)
    assert.equal(parseBankList({ status: 'success', data: [] }), null)
  })
})

describe('parseAccountResolution', () => {
  test('a 200 with a name resolves, tidying the spacing', () => {
    assert.deepEqual(
      parseAccountResolution(
        200,
        {
          status: 'success',
          message: 'Account details fetched',
          data: { account_number: '0690000031', account_name: ' BODE   GEORGE ' },
        },
        '0690000031'
      ),
      { kind: 'resolved', accountNumber: '0690000031', accountName: 'BODE GEORGE' }
    )
  })

  test('a 200 without a name is not a resolution', () => {
    const result = parseAccountResolution(
      200,
      { status: 'success', data: { account_name: '   ' } },
      '0690000031'
    )
    assert.equal(result.kind, 'unavailable')
  })

  test("a 400 Flutterwave explains is 'not_found', with its message", () => {
    assert.deepEqual(
      parseAccountResolution(
        400,
        {
          status: 'error',
          message: 'Sorry, recipient account could not be validated. Please try again',
          data: null,
        },
        '0123456789'
      ),
      {
        kind: 'not_found',
        message: 'Sorry, recipient account could not be validated. Please try again',
      }
    )
  })

  test('401 and 403 are configuration, not a verdict on the account', () => {
    assert.deepEqual(parseAccountResolution(401, {}, 'x'), {
      kind: 'unauthorized',
      httpStatus: 401,
    })
    assert.deepEqual(parseAccountResolution(403, {}, 'x'), {
      kind: 'unauthorized',
      httpStatus: 403,
    })
  })

  test('rate limits, timeouts and 5xx never become a "no"', () => {
    for (const status of [408, 429, 500, 502, 503]) {
      assert.equal(
        parseAccountResolution(status, { status: 'error' }, 'x').kind,
        'unavailable',
        `HTTP ${status}`
      )
    }
  })
})

describe('resolveBankAccount', () => {
  test('posts the number and bank code with the bearer key', async () => {
    const { impl, calls } = fakeFetch(200, {
      status: 'success',
      data: { account_number: '0690000031', account_name: 'BODE GEORGE' },
    })
    const result = await resolveBankAccount({
      accountNumber: '0690000031',
      bankCode: '044',
      secretKey: 'unit-test-key',
      fetchImpl: impl,
    })
    assert.equal(result.kind, 'resolved')
    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.url, 'https://api.flutterwave.com/v3/accounts/resolve')
    assert.equal(calls[0]!.init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), {
      account_number: '0690000031',
      account_bank: '044',
    })
    const headers = calls[0]!.init?.headers as Record<string, string>
    assert.equal(headers.Authorization, 'Bearer unit-test-key')
  })

  test('without a key it does not call out at all', async () => {
    const { impl, calls } = fakeFetch(200, {})
    const result = await resolveBankAccount({
      accountNumber: '0690000031',
      bankCode: '044',
      secretKey: undefined,
      fetchImpl: impl,
    })
    assert.equal(result.kind, 'unavailable')
    assert.equal(calls.length, 0)
  })

  test('a network failure is unavailable', async () => {
    const impl = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    const result = await resolveBankAccount({
      accountNumber: '0690000031',
      bankCode: '044',
      secretKey: 'unit-test-key',
      fetchImpl: impl,
    })
    assert.equal(result.kind, 'unavailable')
  })
})

describe('getBanksCached', () => {
  beforeEach(() => resetBankListCache())

  const LIST = {
    status: 'success',
    data: [{ id: 1, code: '044', name: 'Access Bank' }],
  }

  test('serves a fresh list from cache, then refetches once it is stale', async () => {
    const first = fakeFetch(200, LIST)
    await getBanksCached({ secretKey: 'k', fetchImpl: first.impl, now: 0 })
    await getBanksCached({ secretKey: 'k', fetchImpl: first.impl, now: 1000 })
    assert.equal(first.calls.length, 1, 'second call within the TTL is cached')

    const later = fakeFetch(200, LIST)
    await getBanksCached({
      secretKey: 'k',
      fetchImpl: later.impl,
      now: 7 * 60 * 60 * 1000,
    })
    assert.equal(later.calls.length, 1, 'past the TTL it asks again')
  })

  test('a failed refresh serves the stale copy instead of nothing', async () => {
    await getBanksCached({
      secretKey: 'k',
      fetchImpl: fakeFetch(200, LIST).impl,
      now: 0,
    })
    const failing = fakeFetch(503, { status: 'error' })
    const result = await getBanksCached({
      secretKey: 'k',
      fetchImpl: failing.impl,
      now: 7 * 60 * 60 * 1000,
    })
    assert.equal(result.kind, 'found')
  })
})

test('normalizeAccountName collapses whitespace and trims', () => {
  assert.equal(normalizeAccountName('  ADA \t OBI\nEZE '), 'ADA OBI EZE')
})
