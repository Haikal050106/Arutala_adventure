import { createContext, useContext } from 'react'

export const AdminDemoContext = createContext(null)

export function useAdminDemoStore() {
  const store = useContext(AdminDemoContext)
  if (!store) throw new Error('useAdminDemoStore must be used inside AdminDemoProvider')
  return store
}
