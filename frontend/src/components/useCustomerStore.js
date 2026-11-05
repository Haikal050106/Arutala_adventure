import { createContext, useContext } from 'react'

export const CustomerStoreContext = createContext(null)

export function useCustomerStore() {
  const store = useContext(CustomerStoreContext)
  if (!store) throw new Error('useCustomerStore must be used inside CustomerStoreProvider')
  return store
}
