import { useCallback, useEffect, useMemo, useState } from 'react'
import { customerCategories } from '../data/customer-products'
import { datesOverlap, readLocal, rentalDays, writeLocal } from '../lib/customer-shop'
import { clearCustomerToken, customerApiRequest, readCustomerToken, saveCustomerToken } from '../lib/customer-api'
import { CustomerStoreContext } from './useCustomerStore'
const CART_KEY = 'arutala-customer-cart'
const ORDERS_KEY = 'arutala-customer-orders'
const PURCHASE_REQUEST_KEY = 'arutala-customer-purchase-request'
const RENTAL_REQUEST_KEY = 'arutala-customer-rental-request'
const activeOrderStatuses = new Set([
  'Menunggu konfirmasi', 'Menunggu Konfirmasi', 'Dikonfirmasi', 'Menunggu Pembayaran',
  'Dibayar', 'Disetujui', 'Diproses', 'Aktif', 'Sedang Disewa', 'Menunggu Pengembalian',
])
const orderStatuses = {
  pending_confirmation: 'Menunggu konfirmasi',
  confirmed: 'Dikonfirmasi',
  processing: 'Diproses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}
const rentalStatuses = {
  pending_confirmation: 'Menunggu Konfirmasi',
  confirmed: 'Menunggu Pembayaran',
  active: 'Sedang Disewa',
  returned: 'Selesai',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
}
const paymentStatuses = { unpaid: 'Belum dibayar', partially_paid: 'Sebagian dibayar', paid: 'Lunas' }

function normalizePayments(payments = []) {
  return payments.map((payment) => ({
    id: payment.id,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    provider: payment.provider,
    status: payment.status,
    paidAt: payment.paid_at,
    createdAt: payment.created_at,
    reference: payment.reference,
    cashReceived: payment.cash_received === null ? null : Number(payment.cash_received),
    changeAmount: payment.change_amount === null ? null : Number(payment.change_amount),
  }))
}

function normalizeServerOrder(order) {
  return {
    id: String(order.id),
    orderNumber: order.order_number,
    createdAt: order.created_at,
    customer: {
      name: order.customer?.name || '',
      email: order.customer?.email || '',
      phone: order.customer?.phone || '',
      villageAddress: order.customer?.village_name || '',
    },
    items: order.order_items.map((item) => ({
      id: String(item.id),
      productId: item.product?.slug || String(item.product_id),
      name: item.product?.name || 'Produk',
      kind: 'purchase',
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      rentalDays: 0,
    })),
    total: Number(order.total_amount),
    status: orderStatuses[order.status] || order.status,
    paymentStatus: paymentStatuses[order.payment_status] || 'Belum dibayar',
    amountPaid: Number(order.amount_paid || 0),
    balanceDue: Number(order.balance_due ?? order.total_amount),
    payments: normalizePayments(order.payments),
    prototype: false,
  }
}

function normalizeServerRental(rental) {
  return {
    id: String(rental.id),
    orderNumber: rental.rental_number,
    createdAt: rental.created_at,
    customer: {
      name: rental.customer?.name || '',
      email: rental.customer?.email || '',
      phone: rental.customer?.phone || '',
      villageAddress: rental.village_name || rental.customer?.village_name || '',
    },
    items: rental.rental_items.map((item) => ({
      id: String(item.id),
      productId: item.product?.slug || String(item.product_id),
      name: item.product?.name || 'Perlengkapan',
      kind: 'rental',
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price_per_day),
      startDate: item.start_date,
      returnDate: item.return_date,
      rentalDays: Number(item.rental_days),
    })),
    total: Number(rental.total_amount),
    status: rental.display_status || rentalStatuses[rental.status] || rental.status,
    paymentStatus: paymentStatuses[rental.payment_status] || 'Belum dibayar',
    amountPaid: Number(rental.amount_paid || 0),
    balanceDue: Number(rental.balance_due ?? rental.total_amount),
    payments: normalizePayments(rental.payments),
    stockDeducted: Boolean(rental.stock_deducted),
    rentalBooking: true,
    returnStatus: rental.return_status,
    statusHistories: rental.status_histories || [],
  }
}

function purchaseIdempotencyKey(items) {
  const signature = JSON.stringify(items
    .map((item) => [item.apiId, item.quantity])
    .sort(([firstId], [secondId]) => firstId - secondId))
  const stored = sessionStorage.getItem(PURCHASE_REQUEST_KEY)
  if (stored) {
    const request = JSON.parse(stored)
    if (request.signature === signature && request.key) return request.key
  }
  const key = crypto.randomUUID()
  sessionStorage.setItem(PURCHASE_REQUEST_KEY, JSON.stringify({ signature, key }))
  return key
}

function rentalIdempotencyKey(items) {
  const signature = JSON.stringify(items
    .map((item) => [item.apiId, item.quantity, item.startDate, item.returnDate])
    .sort(([firstId, , firstStart], [secondId, , secondStart]) => firstId - secondId || firstStart.localeCompare(secondStart)))
  const stored = sessionStorage.getItem(RENTAL_REQUEST_KEY)
  if (stored) {
    const request = JSON.parse(stored)
    if (request.signature === signature && request.key) return request.key
  }
  const key = crypto.randomUUID()
  sessionStorage.setItem(RENTAL_REQUEST_KEY, JSON.stringify({ signature, key }))
  return key
}

function customerProfileFrom(payload) {
  if (payload?.user?.role !== 'customer' || !payload.customer) {
    throw new Error('Respons autentikasi pelanggan dari server tidak valid.')
  }
  return {
    id: payload.customer.id,
    name: payload.customer.name,
    email: payload.customer.email,
    phone: payload.customer.phone,
    villageName: payload.customer.village_name || '',
  }
}

function normalizeCategory(category) {
  const fallback = customerCategories.find((item) => item.name === category.name)
    || customerCategories.find((item) => item.name === 'Aksesori')
  return { ...category, image: fallback.image }
}

function normalizeProduct(product) {
  const category = product.category?.name || ''
  const fallbackImage = customerCategories.find((item) => item.name === category)?.image
  return {
    ...product,
    id: product.slug,
    apiId: product.id,
    category,
    categoryId: product.category_id,
    salePrice: Number(product.sale_price),
    rentPricePerDay: Number(product.rent_price_per_day),
    saleStock: Number(product.sale_stock),
    rentalStock: Number(product.rental_stock),
    photos: product.photos || [],
    image: product.image_url || fallbackImage || '',
    imageAlt: product.image_alt || `${product.name}, kategori ${category}`,
  }
}

export function CustomerStoreProvider({ children }) {
  const [cart, setCart] = useState(() => readLocal(CART_KEY, []))
  const [orders, setOrders] = useState(() => readLocal(ORDERS_KEY, []))
  const [serverOrders, setServerOrders] = useState([])
  const [serverRentals, setServerRentals] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [rentalsLoading, setRentalsLoading] = useState(false)
  const [rentalsError, setRentalsError] = useState('')
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(() => Boolean(readCustomerToken()))
  const [authError, setAuthError] = useState('')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [rentalAvailability, setRentalAvailability] = useState({})
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')

  useEffect(() => writeLocal(CART_KEY, cart), [cart])
  useEffect(() => writeLocal(ORDERS_KEY, orders), [orders])
  const allOrders = useMemo(() => [...serverOrders, ...serverRentals, ...orders], [orders, serverOrders, serverRentals])
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const [apiCategories, apiProducts] = await Promise.all([
        customerApiRequest('/categories'),
        customerApiRequest('/products'),
      ])
      if (!Array.isArray(apiCategories) || !Array.isArray(apiProducts)) {
        throw new Error('Format data katalog dari server tidak valid.')
      }
      setCategories(apiCategories.map(normalizeCategory))
      setProducts(apiProducts.map(normalizeProduct))
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Katalog gagal dimuat dari server.')
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    let active = true
    const token = readCustomerToken()
    if (!token) {
      setAuthError('')
      setAuthLoading(false)
      return () => { active = false }
    }

    customerApiRequest('/auth/me', { token })
      .then((payload) => {
        if (active) setProfile(customerProfileFrom(payload))
      })
      .catch((error) => {
        if (error?.status === 401) clearCustomerToken()
        if (active) {
          setProfile(null)
          setAuthError(error instanceof Error ? error.message : 'Sesi pelanggan tidak dapat diperiksa.')
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false)
      })

    return () => { active = false }
  }, [])

  const loadOrders = useCallback(async () => {
    if (!profile) {
      setServerOrders([])
      setOrdersError('')
      setOrdersLoading(false)
      return
    }

    setOrdersLoading(true)
    setOrdersError('')
    try {
      const payload = await customerApiRequest('/customer/orders', { token: readCustomerToken() })
      if (!Array.isArray(payload)) throw new Error('Format riwayat pesanan dari server tidak valid.')
      setServerOrders(payload.map(normalizeServerOrder))
    } catch (error) {
      if (error?.status === 401) {
        clearCustomerToken()
        setProfile(null)
        setAuthError(error.message)
      }
      setOrdersError(error instanceof Error ? error.message : 'Riwayat pesanan gagal dimuat dari server.')
    } finally {
      setOrdersLoading(false)
    }
  }, [profile])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const loadRentals = useCallback(async () => {
    if (!profile) {
      setServerRentals([])
      setRentalsError('')
      setRentalsLoading(false)
      return
    }

    setRentalsLoading(true)
    setRentalsError('')
    try {
      const payload = await customerApiRequest('/customer/rentals', { token: readCustomerToken() })
      if (!Array.isArray(payload)) throw new Error('Format riwayat booking dari server tidak valid.')
      setServerRentals(payload.map(normalizeServerRental))
    } catch (error) {
      if (error?.status === 401) {
        clearCustomerToken()
        setProfile(null)
        setAuthError(error.message)
      }
      setRentalsError(error instanceof Error ? error.message : 'Riwayat booking gagal dimuat dari server.')
    } finally {
      setRentalsLoading(false)
    }
  }, [profile])

  useEffect(() => {
    loadRentals()
  }, [loadRentals])

  const getProduct = (productId) => products.find((product) => product.id === productId)

  const rentalAvailabilityKey = (productId, startDate, returnDate) => `${productId}:${startDate}:${returnDate}`

  const fetchRentalAvailability = useCallback(async (productId, startDate, returnDate) => {
    const product = products.find((item) => item.id === productId)
    if (!product || !startDate || !returnDate || returnDate <= startDate) {
      throw new Error('Pilih produk dan rentang tanggal sewa yang valid.')
    }

    const query = new URLSearchParams({ start_date: startDate, return_date: returnDate })
    const payload = await customerApiRequest(
      `/products/${encodeURIComponent(product.id)}/rental_availability?${query.toString()}`,
    )
    if (!Number.isInteger(payload?.available_quantity) || payload.available_quantity < 0) {
      throw new Error('Respons ketersediaan sewa dari server tidak valid.')
    }

    setRentalAvailability((current) => ({
      ...current,
      [rentalAvailabilityKey(productId, startDate, returnDate)]: payload.available_quantity,
    }))
    return payload.available_quantity
  }, [products])

  const getSaleAvailable = (productId, excludeCartId = null) => {
    const product = getProduct(productId)
    if (!product) return 0
    const ordered = allOrders.filter((order) => order.prototype
      ? activeOrderStatuses.has(order.status)
      : order.status === 'Menunggu konfirmasi').flatMap((order) => order.items)
      .filter((item) => item.productId === productId && item.kind === 'purchase')
      .reduce((sum, item) => sum + item.quantity, 0)
    const inCart = cart.filter((item) => item.id !== excludeCartId && item.productId === productId && item.kind === 'purchase')
      .reduce((sum, item) => sum + item.quantity, 0)
    return Math.max(0, product.saleStock - ordered - inCart)
  }

  const getRentalAvailable = (productId, startDate, returnDate, excludeCartId = null) => {
    const product = getProduct(productId)
    if (!product || !rentalDays(startDate, returnDate)) return 0
    const serverAvailable = rentalAvailability[rentalAvailabilityKey(productId, startDate, returnDate)]
    const ordered = allOrders.filter((order) => activeOrderStatuses.has(order.status) && !order.stockDeducted).flatMap((order) => order.items)
      .filter((item) => item.productId === productId && item.kind === 'rental' && datesOverlap(startDate, returnDate, item.startDate, item.returnDate))
      .reduce((sum, item) => sum + item.quantity, 0)
    const inCart = cart.filter((item) => item.id !== excludeCartId && item.productId === productId && item.kind === 'rental' && datesOverlap(startDate, returnDate, item.startDate, item.returnDate))
      .reduce((sum, item) => sum + item.quantity, 0)
    return Math.max(0, (Number.isInteger(serverAvailable) ? serverAvailable : product.rentalStock - ordered) - inCart)
  }

  const addToCart = ({ productId, kind, quantity, startDate, returnDate }) => {
    const product = getProduct(productId)
    const amount = Number(quantity)
    if (!product || !Number.isInteger(amount) || amount < 1) return { ok: false, message: 'Produk belum tersedia dari katalog server atau jumlah tidak valid.' }
    if (kind === 'rental' && !rentalDays(startDate, returnDate)) return { ok: false, message: 'Pilih tanggal kembali setelah tanggal mulai.' }
    const available = kind === 'purchase'
      ? getSaleAvailable(productId)
      : getRentalAvailable(productId, startDate, returnDate)
    if (amount > available) return { ok: false, message: `Ketersediaan berdasarkan stok API dan pesanan demo lokal hanya ${available} unit untuk pilihan ini.` }

    const lineId = `${kind}-${productId}${kind === 'rental' ? `-${startDate}-${returnDate}` : ''}`
    const unitPrice = kind === 'purchase' ? product.salePrice : product.rentPricePerDay
    setCart((items) => {
      const current = items.find((item) => item.id === lineId)
      if (current) return items.map((item) => item.id === lineId ? { ...item, apiId: product.apiId, quantity: item.quantity + amount } : item)
      return [...items, { id: lineId, productId, apiId: product.apiId, name: product.name, category: product.category, kind, quantity: amount, unitPrice, startDate: startDate || '', returnDate: returnDate || '' }]
    })
    return { ok: true, message: kind === 'purchase' ? 'Produk ditambahkan ke keranjang.' : 'Perlengkapan ditambahkan ke booking sewa.' }
  }

  const updateQuantity = (lineId, quantity) => {
    const amount = Number(quantity)
    if (!Number.isInteger(amount)) return { ok: false, message: 'Jumlah harus berupa bilangan bulat.' }
    if (amount < 1) {
      setCart((items) => items.filter((item) => item.id !== lineId))
      return { ok: true }
    }
    const item = cart.find((line) => line.id === lineId)
    if (!item) return { ok: false, message: 'Item tidak ditemukan.' }
    const available = item.kind === 'purchase'
      ? getSaleAvailable(item.productId, lineId)
      : getRentalAvailable(item.productId, item.startDate, item.returnDate, lineId)
    if (amount > available) return { ok: false, message: `Ketersediaan berdasarkan stok API dan pesanan demo lokal tersisa ${available} unit.` }
    setCart((items) => items.map((line) => line.id === lineId ? { ...line, quantity: amount } : line))
    return { ok: true }
  }

  const updateRentalDates = (lineId, startDate, returnDate) => {
    const item = cart.find((line) => line.id === lineId)
    if (!item || item.kind !== 'rental') return { ok: false, message: 'Item sewa tidak ditemukan.' }
    const days = rentalDays(startDate, returnDate)
    if (!days) return { ok: false, message: 'Tanggal kembali harus setelah tanggal mulai.' }
    const available = getRentalAvailable(item.productId, startDate, returnDate, lineId)
    if (item.quantity > available) return { ok: false, message: `Stok pada rentang tanggal tersebut hanya ${available} unit.` }
    setCart((items) => items.map((line) => line.id === lineId ? { ...line, startDate, returnDate } : line))
    return { ok: true }
  }

  const removeFromCart = (lineId) => setCart((items) => items.filter((item) => item.id !== lineId))

  const placeOrder = (customerDetails) => {
    if (!profile) return { ok: false, message: 'Masuk atau daftar untuk menyimpan pesanan di prototipe ini.' }
    if (!cart.length) return { ok: false, message: 'Keranjang masih kosong.' }
    if (cart.some((item) => item.kind === 'rental') && !customerDetails.villageAddress?.trim()) {
      return { ok: false, message: 'Alamat Desa/Kelurahan wajib diisi untuk penyewaan.' }
    }
    for (const item of cart) {
      const available = item.kind === 'purchase'
        ? getSaleAvailable(item.productId, item.id)
        : getRentalAvailable(item.productId, item.startDate, item.returnDate, item.id)
      if (item.quantity > available) return { ok: false, message: `${item.name}: ketersediaan berubah. Periksa kembali jumlah dan tanggal.` }
    }
    const order = {
      id: `AA-${Date.now().toString().slice(-7)}`,
      createdAt: new Date().toISOString(),
      customer: {
        ...customerDetails,
        villageAddress: cart.some((item) => item.kind === 'rental') ? customerDetails.villageAddress.trim() : '',
      },
      items: cart.map((item) => ({ ...item, rentalDays: item.kind === 'rental' ? rentalDays(item.startDate, item.returnDate) : 0 })),
      total: cart.reduce((sum, item) => sum + item.unitPrice * item.quantity * (item.kind === 'rental' ? rentalDays(item.startDate, item.returnDate) : 1), 0),
      status: 'Menunggu konfirmasi',
      paymentStatus: 'Belum dibayar',
      prototype: true,
    }
    setOrders((items) => [order, ...items])
    setCart([])
    return { ok: true, order }
  }

  const createPurchaseOrder = async ({ notes }) => {
    if (!profile) throw new Error('Sesi pelanggan tidak tersedia. Silakan masuk kembali.')
    const purchaseItems = cart.filter((item) => item.kind === 'purchase').map((item) => ({
      ...item,
      apiId: getProduct(item.productId)?.apiId,
    }))
    if (!purchaseItems.length) throw new Error('Keranjang tidak memiliki produk untuk dibeli.')
    if (purchaseItems.some((item) => !Number.isInteger(item.apiId) || item.quantity < 1)) {
      throw new Error('Keranjang berisi produk atau jumlah yang tidak valid. Muat ulang katalog dan periksa keranjang.')
    }

    const idempotencyKey = purchaseIdempotencyKey(purchaseItems)
    try {
      const payload = await customerApiRequest('/customer/orders', {
        method: 'POST',
        token: readCustomerToken(),
        idempotencyKey,
        body: {
          order: {
            notes,
            items: purchaseItems.map((item) => ({ product_id: item.apiId, quantity: item.quantity })),
          },
        },
      })
      if (!payload?.id || !Array.isArray(payload.order_items)) {
        throw new Error('Respons pesanan dari server tidak valid.')
      }
      const order = normalizeServerOrder(payload)
      setServerOrders((current) => [order, ...current.filter((item) => item.id !== order.id)])
      setCart((current) => current.filter((item) => item.kind !== 'purchase'))
      sessionStorage.removeItem(PURCHASE_REQUEST_KEY)
      return order
    } catch (error) {
      if (error?.status === 401) {
        clearCustomerToken()
        setProfile(null)
        setAuthError(error.message)
      }
      throw error
    }
  }

  const createRentalBooking = async ({ villageName, notes }) => {
    if (!profile) throw new Error('Sesi pelanggan tidak tersedia. Silakan masuk kembali.')
    const rentalItems = cart.filter((item) => item.kind === 'rental').map((item) => ({
      ...item,
      apiId: getProduct(item.productId)?.apiId,
    }))
    if (!rentalItems.length) throw new Error('Keranjang tidak memiliki perlengkapan untuk disewa.')
    if (rentalItems.some((item) => !Number.isInteger(item.apiId) || item.quantity < 1 || !rentalDays(item.startDate, item.returnDate))) {
      throw new Error('Periksa produk, jumlah, dan tanggal sewa di keranjang sebelum melanjutkan.')
    }
    if (!villageName?.trim()) throw new Error('Alamat Desa/Kelurahan wajib diisi untuk booking sewa.')

    const idempotencyKey = rentalIdempotencyKey(rentalItems)
    try {
      const payload = await customerApiRequest('/customer/rentals', {
        method: 'POST',
        token: readCustomerToken(),
        idempotencyKey,
        body: {
          rental: {
            village_name: villageName.trim(),
            notes: notes.trim(),
            items: rentalItems.map((item) => ({
              product_id: item.apiId,
              quantity: item.quantity,
              start_date: item.startDate,
              return_date: item.returnDate,
            })),
          },
        },
      })
      if (!payload?.id || !Array.isArray(payload.rental_items)) {
        throw new Error('Respons booking dari server tidak valid.')
      }
      const booking = normalizeServerRental(payload)
      setServerRentals((current) => [booking, ...current.filter((item) => item.id !== booking.id)])
      setCart((current) => current.filter((item) => item.kind !== 'rental'))
      sessionStorage.removeItem(RENTAL_REQUEST_KEY)
      return booking
    } catch (error) {
      if (error?.status === 401) {
        clearCustomerToken()
        setProfile(null)
        setAuthError(error.message)
      }
      throw error
    }
  }

  const fetchCustomerOrder = useCallback(async (orderId) => {
    try {
      const payload = await customerApiRequest(`/customer/orders/${encodeURIComponent(orderId)}`, {
        token: readCustomerToken(),
      })
      if (!payload?.id || !Array.isArray(payload.order_items)) {
        throw new Error('Respons detail pesanan dari server tidak valid.')
      }
      const order = normalizeServerOrder(payload)
      setServerOrders((current) => [order, ...current.filter((item) => item.id !== order.id)])
      return order
    } catch (error) {
      if (error?.status === 401) {
        clearCustomerToken()
        setProfile(null)
        setAuthError(error.message)
      }
      throw error
    }
  }, [])

  const cancelPurchaseOrder = async (orderId) => {
    try {
      const payload = await customerApiRequest(`/customer/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        token: readCustomerToken(),
      })
      if (!payload?.id || !Array.isArray(payload.order_items)) {
        throw new Error('Respons pembatalan pesanan dari server tidak valid.')
      }
      const order = normalizeServerOrder(payload)
      setServerOrders((current) => current.map((item) => item.id === order.id ? order : item))
      return order
    } catch (error) {
      if (error?.status === 401) {
        clearCustomerToken()
        setProfile(null)
        setAuthError(error.message)
      }
      throw error
    }
  }

  const cancelOrder = (orderId) => setOrders((items) => items.map((order) => order.id === orderId && order.status === 'Menunggu konfirmasi'
    ? { ...order, status: 'Dibatalkan', paymentStatus: 'Tidak ada pembayaran' }
    : order))

  const register = async ({ name, email, phone, password, passwordConfirmation }) => {
    const payload = await customerApiRequest('/auth/customer/register', {
      method: 'POST',
      body: {
        auth: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          password_confirmation: passwordConfirmation,
        },
      },
    })
    const nextProfile = customerProfileFrom(payload)
    if (!payload.token) throw new Error('Server tidak mengembalikan sesi pelanggan.')
    saveCustomerToken(payload.token)
    setAuthError('')
    setProfile(nextProfile)
    return { ok: true, profile: nextProfile }
  }

  const login = async ({ email, password }) => {
    const payload = await customerApiRequest('/auth/customer/login', {
      method: 'POST',
      body: { auth: { email: email.trim(), password } },
    })
    const nextProfile = customerProfileFrom(payload)
    if (!payload.token) throw new Error('Server tidak mengembalikan sesi pelanggan.')
    saveCustomerToken(payload.token)
    setAuthError('')
    setProfile(nextProfile)
    return { ok: true, profile: nextProfile }
  }

  const logout = async () => {
    const token = readCustomerToken()
    clearCustomerToken()
    setProfile(null)
    setServerOrders([])
    setServerRentals([])
    setAuthError('')
    if (!token) return { ok: true }

    try {
      await customerApiRequest('/auth/logout', { method: 'DELETE', token })
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Sesi server belum dapat dicabut.',
      }
    }
  }
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity * (item.kind === 'rental' ? rentalDays(item.startDate, item.returnDate) : 1), 0), [cart])
  const value = { products, categories, catalogLoading, catalogError, reloadCatalog: loadCatalog, cart, orders: allOrders, ordersLoading, ordersError, reloadOrders: loadOrders, rentalsLoading, rentalsError, reloadRentals: loadRentals, profile, authLoading, authError, cartTotal, addToCart, updateQuantity, updateRentalDates, removeFromCart, getSaleAvailable, getRentalAvailable, fetchRentalAvailability, placeOrder, createPurchaseOrder, createRentalBooking, fetchCustomerOrder, cancelPurchaseOrder, cancelOrder, register, login, logout }

  return <CustomerStoreContext.Provider value={value}>{children}</CustomerStoreContext.Provider>
}
