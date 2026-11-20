import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeCustomerList } from '../src/lib/customer-list.js'

test('merging a stale API response preserves a newly created customer', () => {
  const existing = [{ id: 1, name: 'Andi' }]
  const created = { id: 2, name: 'Budi' }

  assert.deepEqual(
    mergeCustomerList([existing[0], created], existing),
    [existing[0], created],
  )
})

test('merging customers replaces matching ids regardless of id type', () => {
  assert.deepEqual(
    mergeCustomerList([{ id: 1, name: 'Nama lama' }], [{ id: '1', name: 'Nama baru' }]),
    [{ id: '1', name: 'Nama baru' }],
  )
})
