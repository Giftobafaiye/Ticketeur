import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  accountCodeContext,
  generatePayoutCode,
  hashPayoutCode,
  payoutCodeContext,
  payoutCodeMatches,
} from './payout-codes'

const base = {
  userId: 'usr_1',
  purpose: 'request_payout' as const,
  context: payoutCodeContext(5_000_000, 'pya_1'),
  code: '048213',
}

describe('payout codes', () => {
  test('six digits, leading zeros kept', () => {
    for (let i = 0; i < 200; i++) {
      assert.match(generatePayoutCode(), /^\d{6}$/)
    }
  })

  test('the right code for the right action matches', async () => {
    const stored = await hashPayoutCode(base)
    assert.equal(await payoutCodeMatches(stored, base), true)
  })

  test('a code is bound to the exact action it was sent for', async () => {
    const stored = await hashPayoutCode(base)
    // Same code, a bigger withdrawal.
    assert.equal(
      await payoutCodeMatches(stored, {
        ...base,
        context: payoutCodeContext(50_000_000, 'pya_1'),
      }),
      false
    )
    // Same code and amount, a different account.
    assert.equal(
      await payoutCodeMatches(stored, {
        ...base,
        context: payoutCodeContext(5_000_000, 'pya_2'),
      }),
      false
    )
  })

  test('a code is bound to its purpose and its user', async () => {
    const stored = await hashPayoutCode(base)
    assert.equal(
      await payoutCodeMatches(stored, { ...base, purpose: 'add_account' }),
      false
    )
    assert.equal(
      await payoutCodeMatches(stored, { ...base, userId: 'usr_2' }),
      false
    )
  })

  test('the wrong code does not match', async () => {
    const stored = await hashPayoutCode(base)
    assert.equal(await payoutCodeMatches(stored, { ...base, code: '048214' }), false)
  })

  test('a digest is never the code, and two digests of one code differ', async () => {
    const a = await hashPayoutCode(base)
    const b = await hashPayoutCode(base)
    assert.ok(!a.includes(base.code))
    assert.notEqual(a, b)
  })

  test('a malformed or tampered digest is false, never a throw', async () => {
    assert.equal(await payoutCodeMatches('garbage', base), false)
    assert.equal(await payoutCodeMatches('bcrypt$1$2$3$4$5', base), false)
    // An absurd cost parameter is refused before scrypt runs.
    assert.equal(
      await payoutCodeMatches('scrypt$999999999$8$1$AAAA$AAAA', base),
      false
    )
  })

  test('account contexts differ by bank and by number', () => {
    assert.notEqual(
      accountCodeContext('044', '0690000031'),
      accountCodeContext('058', '0690000031')
    )
    assert.notEqual(
      accountCodeContext('044', '0690000031'),
      accountCodeContext('044', '0690000032')
    )
  })
})
