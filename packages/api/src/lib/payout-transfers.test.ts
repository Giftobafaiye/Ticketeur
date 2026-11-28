import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { relayTransferWebhook } from './payout-transfers'

function recorder() {
  const calls: unknown[] = []
  return {
    calls,
    trigger: async (id: string, payload: unknown) => {
      calls.push({ id, payload })
      return { id: 'run_fake' }
    },
  }
}

describe('relayTransferWebhook', () => {
  test('a charge event is not ours to handle', async () => {
    const r = recorder()
    const result = await relayTransferWebhook(
      { event: 'charge.completed', data: { id: 1, tx_ref: 'ord_1' } },
      r.trigger
    )
    assert.deepEqual(result, { handled: false })
    assert.equal(r.calls.length, 0)
  })

  test('our transfer is queued for the worker, id as text', async () => {
    const r = recorder()
    const result = await relayTransferWebhook(
      {
        event: 'transfer.completed',
        'event.type': 'Transfer',
        data: { id: 190626, reference: 'TKTP-abc-1', status: 'SUCCESSFUL' },
      },
      r.trigger
    )
    assert.deepEqual(result, { handled: true, queued: true })
    assert.deepEqual(r.calls, [
      {
        id: 'settle-payout-transfer',
        payload: { flwTransferId: '190626', reference: 'TKTP-abc-1' },
      },
    ])
  })

  test('the event type alone is enough to recognise a transfer', async () => {
    const r = recorder()
    const result = await relayTransferWebhook(
      { 'event.type': 'Transfer', data: { id: 5, reference: 'TKTP-abc-2' } },
      r.trigger
    )
    assert.deepEqual(result, { handled: true, queued: true })
  })

  test('a transfer made by hand in the dashboard is acknowledged and ignored', async () => {
    const r = recorder()
    const result = await relayTransferWebhook(
      { event: 'transfer.completed', data: { id: 7, reference: 'dashboard-123' } },
      r.trigger
    )
    assert.deepEqual(result, { handled: true, queued: false })
    assert.equal(r.calls.length, 0)
  })

  test('a spike-script transfer is ignored too', async () => {
    const r = recorder()
    const result = await relayTransferWebhook(
      { event: 'transfer.completed', data: { id: 8, reference: 'TKTP-SPIKE-x-1_PMCKDU_1' } },
      r.trigger
    )
    assert.deepEqual(result, { handled: true, queued: false })
  })

  test('a failed hand-off throws, so the webhook answers 5xx and is retried', async () => {
    await assert.rejects(
      relayTransferWebhook(
        { event: 'transfer.completed', data: { id: 9, reference: 'TKTP-abc-3' } },
        async () => {
          throw new Error('trigger unavailable')
        }
      ),
      /trigger unavailable/
    )
  })
})
