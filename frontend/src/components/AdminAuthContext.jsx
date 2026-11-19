import { useEffect, useMemo, useState } from 'react'
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  adminApiRequest,
  clearAdminToken,
  readAdminToken,
  saveAdminToken,
} from '../lib/admin-api'
import { AdminAuthContext } from './admin-auth-context'

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    const handleSessionExpired = () => {
      clearAdminToken()
      setUser(null)
      setSessionExpired(true)
    }

    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

  useEffect(() => {
    const token = readAdminToken()
    if (!token) {
      setLoading(false)
      return
    }

    adminApiRequest('/auth/me', { token })
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => {
        clearAdminToken()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    async login(email, password) {
      const result = await adminApiRequest('/auth/login', {
        method: 'POST',
        body: { auth: { email, password } },
      })
      saveAdminToken(result.token)
      setUser(result.user)
      setSessionExpired(false)
      return result.user
    },
    async logout() {
      const token = readAdminToken()
      if (token) {
        try {
          await adminApiRequest('/auth/logout', { method: 'DELETE', token })
        } catch (error) {
          if (error.status !== 401) throw error
        }
      }
      clearAdminToken()
      setUser(null)
      setSessionExpired(false)
    },
    sessionExpired,
  }), [loading, sessionExpired, user])

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
