const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '')
const ADMIN_TOKEN_KEY = 'arutala-admin-api-token'

export class AdminApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
  }
}

export async function adminApiRequest(path, { method = 'GET', body, token, idempotencyKey } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) return null

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new AdminApiError(payload.error?.message || 'Permintaan ke server gagal.', response.status)
  }
  return payload
}

export async function adminApiUpload(path, { method = 'POST', file, body = {}, token } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const formData = new FormData()
  if (file) formData.append('file', file)
  Object.entries(body).forEach(([key, value]) => formData.append(key, String(value)))

  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: formData })
  if (response.status === 204) return null

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new AdminApiError(payload.error?.message || 'Permintaan ke server gagal.', response.status)
  }
  return payload
}

export function readAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY)
}

export function saveAdminToken(token) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY)
}
