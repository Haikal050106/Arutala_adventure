const STAFF_ROLES = ['admin', 'cashier']

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role)
}

export function getStaffLoginDestination(role) {
  if (role === 'admin') return '/admin'
  if (role === 'cashier') return '/admin/orders'
  return '/'
}

export function getStaffRouteRedirect(role, allowedRoles) {
  if (allowedRoles.includes(role)) return null
  if (role === 'cashier') return '/admin/orders'
  return '/'
}
