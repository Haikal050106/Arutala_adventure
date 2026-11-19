import assert from 'node:assert/strict'
import test from 'node:test'
import { uniqueRentalPeriods } from '../src/lib/customer-shop.js'

test('collapses repeated rental periods and preserves distinct periods', () => {
  const firstPeriod = { start_date: '2026-11-16', return_date: '2026-11-17' }
  const secondPeriod = { start_date: '2026-11-18', return_date: '2026-11-20' }

  assert.deepEqual(
    uniqueRentalPeriods([firstPeriod, { ...firstPeriod }, secondPeriod, { ...secondPeriod }]),
    [
      { startDate: '2026-11-16', returnDate: '2026-11-17' },
      { startDate: '2026-11-18', returnDate: '2026-11-20' },
    ],
  )
})

test('ignores rental items without a complete date range', () => {
  assert.deepEqual(
    uniqueRentalPeriods([
      { start_date: '2026-11-16', return_date: '2026-11-17' },
      { start_date: '2026-11-16' },
      { return_date: '2026-11-17' },
    ]),
    [{ startDate: '2026-11-16', returnDate: '2026-11-17' }],
  )
})
