const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '')

export class CustomerApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'CustomerApiError'
    this.status = status
  }
}

export async function customerApiRequest(path, { method = 'GET', body, token, idempotencyKey } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new CustomerApiError('Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.', 0)
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const apiError = payload?.error
    const details = Array.isArray(apiError?.details) ? apiError.details.join(' ') : ''
    const message = [apiError?.message, details].filter(Boolean).join(' ')
    throw new CustomerApiError(message || 'Permintaan ke server gagal.', response.status)
  }
  return payload
}

const CUSTOMER_TOKEN_KEY = 'arutala-customer-api-token'

export function readCustomerToken() {
  return sessionStorage.getItem(CUSTOMER_TOKEN_KEY)
}

export function saveCustomerToken(token) {
  sessionStorage.setItem(CUSTOMER_TOKEN_KEY, token)
}

export function clearCustomerToken() {
  sessionStorage.removeItem(CUSTOMER_TOKEN_KEY)
}
