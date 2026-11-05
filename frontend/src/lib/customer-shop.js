export const money = (value) => `Rp${Number(value).toLocaleString('id-ID')}`

export function rentalDays(startDate, returnDate) {
  if (!startDate || !returnDate) return 0
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${returnDate}T00:00:00`)
  const days = Math.round((end - start) / 86400000)
  return Number.isFinite(days) && days > 0 ? days : 0
}

export function datesOverlap(startA, endA, startB, endB) {
  return Boolean(startA && endA && startB && endB && startA < endB && startB < endA)
}

export function readLocal(key, fallback) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

export function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // The prototype can still operate in memory if browser storage is unavailable.
  }
}

export async function hashDemoPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}