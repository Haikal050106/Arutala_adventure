import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getStaffLoginDestination,
  getStaffRouteRedirect,
  isStaffRole,
} from '../src/lib/admin-access.js'

test('only Admin and Cashier are staff roles', () => {
  assert.equal(isStaffRole('admin'), true)
  assert.equal(isStaffRole('cashier'), true)
  assert.equal(isStaffRole('customer'), false)
})

test('login sends Admin and Cashier to their staff pages and Customer to public home', () => {
  assert.equal(getStaffLoginDestination('admin'), '/admin')
  assert.equal(getStaffLoginDestination('cashier'), '/admin/orders')
  assert.equal(getStaffLoginDestination('customer'), '/')
})

test('Customer route denial resolves to public home without redirecting between Admin routes', () => {
  const staffRoles = ['admin', 'cashier']
  const adminOnly = ['admin']

  assert.equal(getStaffRouteRedirect('customer', staffRoles), '/')
  assert.equal(getStaffRouteRedirect('customer', adminOnly), '/')
  assert.equal(getStaffRouteRedirect('admin', staffRoles), null)
  assert.equal(getStaffRouteRedirect('cashier', staffRoles), null)
  assert.equal(getStaffRouteRedirect('cashier', adminOnly), '/admin/orders')
})
