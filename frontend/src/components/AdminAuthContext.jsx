import { useEffect, useMemo, useState } from 'react'
import { adminApiRequest, clearAdminToken, readAdminToken, saveAdminToken } from '../lib/admin-api'
import { AdminAuthContext } from './admin-auth-context'

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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
    },
  }), [loading, user])

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
