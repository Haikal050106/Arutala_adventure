import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, Search, Trash2, Pencil, PackageOpen } from 'lucide-react'
import AdminRecordDialog from '../../components/AdminRecordDialog'
import { useAdminDemoStore } from '../../components/useAdminDemoStore'
import { useAdminAuth } from '../../components/admin-auth-context'
import { adminApiRequest, readAdminToken } from '../../lib/admin-api'
import { money, rentalDays, readLocal } from '../../lib/customer-shop'

const activeStatuses = new Set(['Menunggu konfirmasi', 'Dikonfirmasi', 'Diproses'])
const purchaseStatuses = ['Menunggu konfirmasi', 'Dikonfirmasi', 'Diproses', 'Selesai', 'Dibatalkan']
const rentalStatuses = ['Menunggu konfirmasi', 'Dikonfirmasi', 'Diproses', 'Dikembalikan', 'Dibatalkan']
const orderStatusLabels = {
  pending_confirmation: 'Menunggu konfirmasi',
  confirmed: 'Dikonfirmasi',
  processing: 'Diproses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}
const paymentStatusLabels = { unpaid: 'Belum dibayar', partially_paid: 'Sebagian dibayar', paid: 'Lunas' }
const statusClass = (status) => status === 'Dibatalkan' ? 'bg-slate-100 text-slate-600' : status === 'Selesai' || status === 'Dikembalikan' ? 'bg-emerald-50 text-emerald-700' : status === 'Diproses' ? 'bg-blue-50 text-blue-700' : status === 'Dikonfirmasi' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
const isoDate = (date) => new Date(date).toLocaleDateString('id-ID', { dateStyle: 'medium' })
const slug = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const apiErrorMessage = (error) => error instanceof Error ? error.message : 'Permintaan ke server gagal.'

function normalizeProduct(product) {
  return {
    ...product,
    category: product.category?.name || '',
    salePrice: Number(product.sale_price),
    rentPricePerDay: Number(product.rent_price_per_day),
    saleStock: Number(product.sale_stock),
    rentalStock: Number(product.rental_stock),
    image: product.image_url || '',
    imageAlt: product.image_alt || product.name,
  }
}

function normalizeOrder(order) {
  return {
    ...order,
    id: order.order_number,
    createdAt: order.created_at,
    customer: {
      ...order.customer,
      villageAddress: order.customer?.village_name || '',
    },
    items: order.order_items.map((item) => ({
      ...item,
      productId: item.product?.slug || String(item.product_id),
      name: item.product?.name || 'Produk',
      kind: 'purchase',
    })),
    total: Number(order.total_amount),
    status: orderStatusLabels[order.status] || order.status,
    prototype: false,
  }
}

function rentalRecords(orders) {
  return orders.flatMap((order) => order.items.filter((item) => item.kind === 'rental').map((item) => ({ order, item })))
}

function orderTypes(order) {
  const kinds = new Set(order.items.map((item) => item.kind))
  return kinds.size > 1 ? 'Campuran' : kinds.has('rental') ? 'Penyewaan' : 'Pembelian'
}

function calculateTotals(data) {
  const orders = data.orders
  const rentals = rentalRecords(orders)
  const completed = orders.filter((order) => order.status === 'Selesai' || order.status === 'Dikembalikan')
  return {
    products: data.products.length,
    categories: data.categories.length,
    customers: data.customers.length,
    orders: orders.length,
    activeRentals: rentals.filter(({ order }) => activeStatuses.has(order.status)).length,
    revenue: completed.reduce((sum, order) => sum + order.total, 0),
  }
}

export default function AdminSectionPage({ section }) {
  const { data, setData } = useAdminDemoStore()
  const { notify } = useOutletContext()
  const isCatalogSection = ['products', 'categories'].includes(section.key)
  const isCustomerSection = section.key === 'customers'
  const isOrderSection = section.key === 'orders'
  const isApiSection = isCatalogSection || isCustomerSection || isOrderSection
  const { user } = useAdminAuth()
  const canEditCustomers = user?.role === 'admin'
  const [catalogData, setCatalogData] = useState(null)
  const [catalogLoading, setCatalogLoading] = useState(isCatalogSection)
  const [catalogError, setCatalogError] = useState('')
  const [customersData, setCustomersData] = useState(null)
  const [customersLoading, setCustomersLoading] = useState(isCustomerSection)
  const [customersError, setCustomersError] = useState('')
  const [serverOrders, setServerOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(isOrderSection)
  const [ordersError, setOrdersError] = useState('')
  const [websiteOrders] = useState(() => {
    const stored = readLocal('arutala-customer-orders', [])
    return Array.isArray(stored) ? stored : []
  })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(section.key === 'products' ? 'Semua kategori' : 'Semua status')
  const [dialog, setDialog] = useState(null)
  const [reportKind, setReportKind] = useState('Semua transaksi')
  const normalizedQuery = query.trim().toLowerCase()
  const viewData = useMemo(() => isCatalogSection
    ? { ...data, products: catalogData?.products || [], categories: catalogData?.categories || [] }
    : isCustomerSection
      ? { ...data, customers: customersData || [] }
      : data, [catalogData, customersData, data, isCatalogSection, isCustomerSection])
  const totals = useMemo(() => calculateTotals(data), [data])

  useEffect(() => {
    if (!isCatalogSection) return undefined
    let active = true
    const loadCatalog = async () => {
      setCatalogLoading(true)
      setCatalogError('')
      try {
        const token = readAdminToken()
        const [categories, products] = await Promise.all([
          adminApiRequest('/categories', { token }),
          adminApiRequest('/products', { token }),
        ])
        if (active) {
          setCatalogData({ categories, products: products.map(normalizeProduct) })
        }
      } catch (error) {
        if (active) setCatalogError(apiErrorMessage(error))
      } finally {
        if (active) setCatalogLoading(false)
      }
    }
    loadCatalog()
    return () => { active = false }
  }, [section.key, isCatalogSection])

  useEffect(() => {
    if (!isCustomerSection) return undefined
    let active = true
    const loadCustomers = async () => {
      setCustomersLoading(true)
      setCustomersError('')
      try {
        const customers = await adminApiRequest('/customers', { token: readAdminToken() })
        if (active) {
          setCustomersData(customers.map((customer) => ({
            ...customer,
            createdAt: customer.created_at,
          })))
        }
      } catch (error) {
        if (active) setCustomersError(apiErrorMessage(error))
      } finally {
        if (active) setCustomersLoading(false)
      }
    }
    loadCustomers()
    return () => { active = false }
  }, [isCustomerSection])

  useEffect(() => {
    if (!isOrderSection) return undefined
    let active = true
    const loadOrders = async () => {
      setOrdersLoading(true)
      setOrdersError('')
      try {
        const orders = await adminApiRequest('/orders', { token: readAdminToken() })
        if (!Array.isArray(orders)) throw new Error('Format daftar pesanan dari server tidak valid.')
        if (active) setServerOrders(orders.map(normalizeOrder))
      } catch (error) {
        if (active) setOrdersError(apiErrorMessage(error))
      } finally {
        if (active) setOrdersLoading(false)
      }
    }
    loadOrders()
    return () => { active = false }
  }, [isOrderSection])

  const websiteRentals = useMemo(() => websiteOrders
    .filter((order) => order.items?.some((item) => item.kind === 'rental'))
    .map((order) => ({ ...order, source: 'customer-website' })), [websiteOrders])
  const rentals = useMemo(() => {
    const adminOrderIds = new Set(data.orders.map((order) => order.id))
    return rentalRecords([...data.orders, ...websiteRentals.filter((order) => !adminOrderIds.has(order.id))])
  }, [data.orders, websiteRentals])

  const visibleRecords = useMemo(() => {
    if (section.key === 'products') return viewData.products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(normalizedQuery) && (filter === 'Semua kategori' || product.category === filter))
    if (section.key === 'categories') return viewData.categories.filter((category) => `${category.name} ${category.description}`.toLowerCase().includes(normalizedQuery))
    if (section.key === 'orders') return serverOrders.filter((order) => `${order.id} ${order.customer.name} ${order.customer.email}`.toLowerCase().includes(normalizedQuery) && (filter === 'Semua status' || order.status === filter))
    if (section.key === 'rentals') return rentals.filter(({ order, item }) => `${order.id} ${order.customer.name} ${order.customer.villageAddress || ''} ${item.name}`.toLowerCase().includes(normalizedQuery) && (filter === 'Semua status' || order.status === filter))
    if (section.key === 'customers') return viewData.customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(normalizedQuery))
    return data.orders.filter((order) => `${order.id} ${order.customer.name} ${order.customer.email}`.toLowerCase().includes(normalizedQuery) && (reportKind === 'Semua transaksi' || order.items.some((item) => reportKind === 'Pembelian' ? item.kind === 'purchase' : item.kind === 'rental')))
  }, [data, filter, normalizedQuery, reportKind, rentals, section.key, serverOrders, viewData])

  const save = async (values) => {
    const now = new Date().toISOString()
    if (section.key === 'products') {
      const name = values.name.trim()
      const category = viewData.categories.find((item) => item.name === values.category)
      if (!category) return 'Pilih kategori yang tersedia.'
      if (viewData.products.some((product) => product.name.toLowerCase() === name.toLowerCase() && product.id !== dialog?.record?.id)) return 'Nama produk sudah digunakan.'
      if (isCatalogSection) {
        try {
          const product = await adminApiRequest(dialog?.record ? `/products/${dialog.record.slug}` : '/products', {
            method: dialog?.record ? 'PATCH' : 'POST',
            token: readAdminToken(),
            body: {
              product: {
                category_id: category.id,
                name,
                description: values.description.trim(),
                sale_price: Number(values.salePrice),
                rent_price_per_day: Number(values.rentPricePerDay),
                sale_stock: Number(values.saleStock),
                rental_stock: Number(values.rentalStock),
                featured: dialog?.record?.featured ?? false,
                image_url: values.image?.trim() || null,
                image_alt: name,
              },
            },
          })
          const normalizedProduct = normalizeProduct(product)
          setCatalogData((current) => ({
            ...current,
            products: dialog?.record
              ? current.products.map((item) => item.id === normalizedProduct.id ? normalizedProduct : item)
              : [...current.products, normalizedProduct],
          }))
          notify(dialog?.record ? 'Perubahan produk disimpan.' : 'Produk ditambahkan.')
          return ''
        } catch (error) {
          return apiErrorMessage(error)
        }
      }
      const reservedSale = data.orders.filter((order) => order.status !== 'Dibatalkan').flatMap((order) => order.items).filter((item) => item.productId === dialog?.record?.id && item.kind === 'purchase').reduce((sum, item) => sum + item.quantity, 0)
      const productId = dialog?.record?.id
      const activeRentals = rentalRecords(data.orders).filter(({ order, item }) => activeStatuses.has(order.status) && item.productId === productId)
      const rentalStartDates = [...new Set(activeRentals.map(({ item }) => item.startDate))]
      const reservedRental = rentalStartDates.reduce((maximum, date) => Math.max(maximum, activeRentals.filter(({ item }) => item.startDate <= date && item.returnDate > date).reduce((sum, { item }) => sum + item.quantity, 0)), 0)
      if (Number(values.saleStock) < reservedSale) return `Stok jual tidak boleh kurang dari ${reservedSale} unit yang sudah dipesan.`
      if (Number(values.rentalStock) < reservedRental) return `Stok sewa tidak boleh kurang dari ${reservedRental} unit yang sedang dibooking bersamaan.`
      const product = {
        ...dialog?.record,
        id: dialog?.record?.id || `${slug(name)}-${Date.now().toString().slice(-5)}`,
        name,
        category: values.category,
        description: values.description.trim(),
        salePrice: Number(values.salePrice),
        rentPricePerDay: Number(values.rentPricePerDay),
        saleStock: Number(values.saleStock),
        rentalStock: Number(values.rentalStock),
        image: values.image?.trim() || '',
        imageAlt: name,
      }
      setData((current) => ({ ...current, products: dialog?.record ? current.products.map((item) => item.id === product.id ? product : item) : [...current.products, product] }))
      notify(dialog?.record ? 'Perubahan produk disimpan.' : 'Produk ditambahkan.')
      return ''
    }

    if (section.key === 'categories') {
      const name = values.name.trim()
      if (viewData.categories.some((category) => category.name.toLowerCase() === name.toLowerCase() && category.id !== dialog?.record?.id)) return 'Nama kategori sudah digunakan.'
      if (isCatalogSection) {
        try {
          const category = await adminApiRequest(dialog?.record ? `/categories/${dialog.record.id}` : '/categories', {
            method: dialog?.record ? 'PATCH' : 'POST',
            token: readAdminToken(),
            body: { category: { name, description: values.description.trim() } },
          })
          setCatalogData((current) => ({
            ...current,
            categories: dialog?.record
              ? current.categories.map((item) => item.id === category.id ? category : item)
              : [...current.categories, category],
            products: dialog?.record
              ? current.products.map((product) => product.category_id === category.id
                ? { ...product, category: category.name }
                : product)
              : current.products,
          }))
          notify(dialog?.record ? 'Perubahan kategori disimpan.' : 'Kategori ditambahkan.')
          return ''
        } catch (error) {
          return apiErrorMessage(error)
        }
      }
      const category = { ...dialog?.record, id: dialog?.record?.id || `cat-${slug(name)}-${Date.now().toString().slice(-5)}`, name, description: values.description.trim() }
      setData((current) => ({
        ...current,
        categories: dialog?.record ? current.categories.map((item) => item.id === category.id ? category : item) : [...current.categories, category],
        products: dialog?.record ? current.products.map((product) => product.category === dialog.record.name ? { ...product, category: name } : product) : current.products,
      }))
      notify(dialog?.record ? 'Perubahan kategori disimpan.' : 'Kategori ditambahkan.')
      return ''
    }

    if (section.key === 'customers') {
      const email = values.email.trim().toLowerCase()
      if (viewData.customers.some((customer) => customer.email.toLowerCase() === email && customer.id !== dialog?.record?.id)) return 'Email sudah digunakan pelanggan lain.'
      try {
        const customer = await adminApiRequest(dialog?.record ? `/customers/${dialog.record.id}` : '/customers', {
          method: dialog?.record ? 'PATCH' : 'POST',
          token: readAdminToken(),
          body: {
            customer: {
              name: values.name.trim(),
              email,
              phone: values.phone.trim(),
            },
          },
        })
        const normalizedCustomer = { ...customer, createdAt: customer.created_at }
        setCustomersData((current) => dialog?.record
          ? current.map((item) => item.id === normalizedCustomer.id ? normalizedCustomer : item)
          : [...current, normalizedCustomer])
        notify(dialog?.record ? 'Perubahan pelanggan disimpan.' : 'Pelanggan ditambahkan.')
        return ''
      } catch (error) {
        return apiErrorMessage(error)
      }
    }
    if (section.key === 'orders') {
      if (dialog.record) {
        if (values.status === 'Dibatalkan' && values.paymentStatus === 'Lunas') return 'Pesanan yang dibatalkan tidak dapat berstatus lunas pada simulasi ini.'
        setData((current) => ({ ...current, orders: current.orders.map((order) => order.id === dialog.record.id ? { ...order, status: values.status, paymentStatus: values.paymentStatus } : order) }))
        notify('Status pesanan diperbarui.')
        return ''
      }
      const customer = data.customers.find((item) => item.id === values.customerId)
      const product = data.products.find((item) => item.id === values.productId)
      const quantity = Number(values.quantity)
      if (!customer || !product) return 'Pilih pelanggan dan produk yang tersedia.'
      if (!Number.isInteger(quantity) || quantity < 1) return 'Jumlah harus berupa bilangan bulat minimal 1.'
      const reserved = data.orders.filter((order) => order.status !== 'Dibatalkan').flatMap((order) => order.items).filter((item) => item.productId === product.id && item.kind === 'purchase').reduce((sum, item) => sum + item.quantity, 0)
      if (quantity > product.saleStock - reserved) return `Stok pembelian yang tersedia hanya ${Math.max(0, product.saleStock - reserved)} unit.`
      const item = { id: `purchase-${product.id}-${Date.now()}`, productId: product.id, name: product.name, category: product.category, kind: 'purchase', quantity, unitPrice: product.salePrice, startDate: '', returnDate: '', rentalDays: 0 }
      const order = { id: `AA-${Date.now().toString().slice(-8)}`, createdAt: now, customer: { name: customer.name, email: customer.email, phone: customer.phone }, items: [item], total: item.unitPrice * quantity, status: values.status || 'Menunggu konfirmasi', paymentStatus: values.paymentStatus || 'Belum dibayar', prototype: true }
      setData((current) => ({ ...current, orders: [order, ...current.orders] }))
      notify('Pesanan demo ditambahkan.')
      return ''
    }

    if (section.key === 'rentals') {
      const days = rentalDays(values.startDate, values.returnDate)
      const quantity = Number(values.quantity)
      if (!days) return 'Tanggal kembali harus setelah tanggal mulai.'
      if (!Number.isInteger(quantity) || quantity < 1) return 'Jumlah harus berupa bilangan bulat minimal 1.'
      if (dialog.record) {
        const { order: oldOrder, item: oldItem } = dialog.record
        const product = data.products.find((item) => item.id === oldItem.productId)
        if (!product) return 'Produk penyewaan tidak lagi tersedia.'
        const reserved = rentals.filter(({ order, item }) => order.id !== oldOrder.id && activeStatuses.has(order.status) && item.productId === product.id && values.startDate < item.returnDate && item.startDate < values.returnDate).reduce((sum, { item }) => sum + item.quantity, 0)
        if (activeStatuses.has(values.status) && quantity > product.rentalStock - reserved) return `Stok sewa pada periode tersebut hanya ${Math.max(0, product.rentalStock - reserved)} unit.`
        setData((current) => ({ ...current, orders: current.orders.map((order) => order.id !== oldOrder.id ? order : {
          ...order,
          status: values.status,
          items: order.items.map((item) => item.id === oldItem.id ? { ...item, quantity, startDate: values.startDate, returnDate: values.returnDate, rentalDays: days } : item),
          total: order.items.reduce((sum, item) => sum + (item.id === oldItem.id ? oldItem.unitPrice * quantity * days : item.unitPrice * item.quantity * (item.rentalDays || 1)), 0),
        }) }))
        notify('Perubahan penyewaan disimpan.')
        return ''
      }
      const customer = data.customers.find((item) => item.id === values.customerId)
      const product = data.products.find((item) => item.id === values.productId)
      if (!customer || !product) return 'Pilih pelanggan dan produk yang tersedia.'
      const reserved = rentals.filter(({ order, item }) => activeStatuses.has(order.status) && item.productId === product.id && values.startDate < item.returnDate && item.startDate < values.returnDate).reduce((sum, { item }) => sum + item.quantity, 0)
      if (quantity > product.rentalStock - reserved) return `Stok sewa pada periode tersebut hanya ${Math.max(0, product.rentalStock - reserved)} unit.`
      const item = { id: `rental-${product.id}-${Date.now()}`, productId: product.id, name: product.name, category: product.category, kind: 'rental', quantity, unitPrice: product.rentPricePerDay, startDate: values.startDate, returnDate: values.returnDate, rentalDays: days }
      const order = { id: `AA-${Date.now().toString().slice(-8)}`, createdAt: now, customer: { name: customer.name, email: customer.email, phone: customer.phone }, items: [item], total: item.unitPrice * quantity * days, status: values.status || 'Menunggu konfirmasi', paymentStatus: 'Belum dibayar', prototype: true }
      setData((current) => ({ ...current, orders: [order, ...current.orders] }))
      notify('Penyewaan demo ditambahkan.')
      return ''
    }
    return 'Jenis data tidak didukung.'
  }

  const remove = async (record) => {
    if (section.key === 'categories' && !isCatalogSection && data.products.some((product) => product.category === record.name)) {
      notify('Kategori tidak dapat dihapus selama masih digunakan oleh produk.', 'error')
      return
    }
    if (section.key === 'customers' && !isApiSection && data.orders.some((order) => order.customer.email.toLowerCase() === record.email.toLowerCase())) {
      notify('Pelanggan memiliki riwayat pesanan dan tidak dapat dihapus.', 'error')
      return
    }
    const label = section.key === 'products' ? record.name : section.key === 'categories' ? record.name : section.key === 'customers' ? record.name : record.id
    if (!window.confirm(`Hapus ${label}? Tindakan ini tidak dapat dibatalkan.`)) return
    if (isCustomerSection) {
      try {
        await adminApiRequest(`/customers/${record.id}`, { method: 'DELETE', token: readAdminToken() })
        setCustomersData((current) => current.filter((item) => item.id !== record.id))
        notify('Data berhasil dihapus.')
      } catch (error) {
        notify(apiErrorMessage(error), 'error')
      }
      return
    }
    if (isCatalogSection) {
      try {
        const path = section.key === 'products' ? `/products/${record.slug}` : `/categories/${record.id}`
        await adminApiRequest(path, { method: 'DELETE', token: readAdminToken() })
        setCatalogData((current) => ({
          ...current,
          products: section.key === 'products' ? current.products.filter((item) => item.id !== record.id) : current.products,
          categories: section.key === 'categories' ? current.categories.filter((item) => item.id !== record.id) : current.categories,
        }))
        notify('Data berhasil dihapus.')
      } catch (error) {
        notify(apiErrorMessage(error), 'error')
      }
      return
    }
    if (section.key === 'products') setData((current) => ({ ...current, products: current.products.filter((item) => item.id !== record.id) }))
    if (section.key === 'categories') setData((current) => ({ ...current, categories: current.categories.filter((item) => item.id !== record.id) }))
    if (section.key === 'customers') setData((current) => ({ ...current, customers: current.customers.filter((item) => item.id !== record.id) }))
    if (section.key === 'orders') setData((current) => ({ ...current, orders: current.orders.filter((item) => item.id !== record.id) }))
    if (section.key === 'rentals') setData((current) => ({ ...current, orders: current.orders.flatMap((order) => {
      if (order.id !== record.order.id) return [order]
      const items = order.items.filter((item) => item.id !== record.item.id)
      return items.length ? [{ ...order, items, total: items.reduce((sum, item) => sum + item.unitPrice * item.quantity * (item.rentalDays || 1), 0) }] : []
    }) }))
    notify('Data berhasil dihapus.')
  }

  const addable = !['orders', 'reports'].includes(section.key)
  const title = section.label
  const count = visibleRecords.length
  const searchLabel = section.key === 'reports' ? 'Cari transaksi' : `Cari ${section.label.toLowerCase()}`

  return <div>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Area Admin · {title}</p>
        <h1 className="m-0 text-2xl font-bold tracking-tight text-navy max-sm:text-xl">{title}</h1>
        <p className="mb-0 mt-2 text-sm text-slate-600">{section.description}</p>
      </div>
      {addable && <button type="button" onClick={() => setDialog({ record: null })} disabled={isCatalogSection && (catalogLoading || Boolean(catalogError)) || isCustomerSection && (customersLoading || Boolean(customersError)) || section.key === 'products' && viewData.categories.length === 0 || ['orders', 'rentals'].includes(section.key) && (!data.products.length || !data.customers.length)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white transition hover:bg-[#E7650D] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} aria-hidden="true" />Tambah {section.key === 'products' ? 'Produk' : section.key === 'categories' ? 'Kategori' : section.key === 'orders' ? 'Pesanan' : section.key === 'rentals' ? 'Penyewaan' : 'Pelanggan'}</button>}
    </div>

    {catalogError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Data {title.toLowerCase()} gagal dimuat dari server: {catalogError}</p>}
    {customersError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Data {title.toLowerCase()} gagal dimuat dari server: {customersError}</p>}
    {ordersError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Daftar pesanan gagal dimuat dari server: {ordersError}</p>}

    {section.key === 'reports' && <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan laporan">
      {[['Total pesanan', totals.orders], ['Penyewaan aktif', totals.activeRentals], ['Pelanggan', totals.customers], ['Pendapatan selesai', money(totals.revenue)]].map(([label, value]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="m-0 text-xs font-medium text-slate-500">{label}</p><p className="mb-0 mt-2 text-xl font-bold text-navy">{value}</p></article>)}
    </section>}

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div><h2 className="m-0 text-sm font-semibold text-navy">{section.key === 'reports' ? 'Rincian transaksi' : `Daftar ${title.toLowerCase()}`}</h2><p className="mb-0 mt-1 text-xs text-slate-500">{count} data · {isApiSection ? 'tersimpan di server' : 'tersimpan di browser ini'}</p></div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <label className="relative min-w-[190px] flex-1 sm:flex-none"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchLabel} aria-label={searchLabel} className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>
          {section.key === 'products' && <select aria-label="Filter kategori" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none"><option>Semua kategori</option>{viewData.categories.map((category) => <option key={category.id}>{category.name}</option>)}</select>}
          {['orders', 'rentals'].includes(section.key) && <select aria-label="Filter status" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none"><option>Semua status</option>{(section.key === 'rentals' ? rentalStatuses : purchaseStatuses).map((status) => <option key={status}>{status}</option>)}</select>}
          {section.key === 'reports' && <select aria-label="Filter jenis transaksi" value={reportKind} onChange={(event) => setReportKind(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none"><option>Semua transaksi</option><option>Pembelian</option><option>Penyewaan</option></select>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>{(section.key === 'products' ? ['Produk', 'Kategori', 'Harga beli', 'Harga sewa / hari', 'Stok jual / sewa', 'Aksi'] : section.key === 'categories' ? ['Kategori', 'Deskripsi', 'Jumlah produk', 'Aksi'] : section.key === 'orders' || section.key === 'reports' ? ['ID transaksi', 'Tanggal', 'Pelanggan', 'Jenis', 'Total', 'Status', ...(section.key === 'orders' ? ['Pembayaran'] : []), ...(section.key === 'orders' && !isOrderSection ? ['Aksi'] : [])] : section.key === 'rentals' ? ['ID sewa', 'Pelanggan', 'Alamat Desa/Kelurahan', 'Perlengkapan', 'Periode', 'Jumlah', 'Status', 'Aksi'] : ['Pelanggan', 'Email', 'Telepon', 'Bergabung', 'Pesanan', 'Aksi']).map((column) => <th key={column} className="h-11 whitespace-nowrap px-4">{column}</th>)}</tr>
          </thead>
          <tbody>
            {isApiSection && (catalogLoading || customersLoading || ordersLoading) && <tr><td colSpan={section.key === 'products' ? 6 : section.key === 'categories' ? 4 : section.key === 'orders' ? 7 : 6} className="h-20 text-center text-sm text-slate-500">Memuat data dari server...</td></tr>}
            {isApiSection && !catalogLoading && !customersLoading && !ordersLoading && !catalogError && !customersError && !ordersError && visibleRecords.length === 0 && <tr><td colSpan={section.key === 'products' ? 6 : section.key === 'categories' ? 4 : section.key === 'orders' ? 7 : 6} className="h-20 text-center text-sm text-slate-500">Belum ada data yang cocok.</td></tr>}
            {visibleRecords.map((record) => {
              const isRental = section.key === 'rentals'
              const isReport = section.key === 'reports'
              const order = isRental ? record.order : record
              const item = isRental ? record.item : null
              const customerOrders = section.key === 'customers' && !isCustomerSection ? data.orders.filter((orderRecord) => orderRecord.customer.email.toLowerCase() === record.email.toLowerCase()).length : null
              return <tr key={isRental ? `${order.id}-${item.id}` : record.id} className="border-t border-slate-100 text-xs text-slate-600">
                {section.key === 'products' && <><td className="h-14 px-4 font-semibold text-navy">{record.name}</td><td className="px-4">{record.category}</td><td className="px-4">{money(record.salePrice)}</td><td className="px-4">{money(record.rentPricePerDay)}</td><td className="px-4">{record.saleStock} / {record.rentalStock}</td><td className="px-4">{renderActions(record)}</td></>}
                {section.key === 'categories' && <><td className="h-14 px-4 font-semibold text-navy">{record.name}</td><td className="max-w-sm px-4">{record.description}</td><td className="px-4">{viewData.products.filter((product) => product.category_id === record.id).length}</td><td className="px-4">{renderActions(record)}</td></>}
                {(section.key === 'orders' || isReport) && <><td className="h-14 px-4 font-semibold text-navy">{record.id}</td><td className="whitespace-nowrap px-4">{isoDate(record.createdAt)}</td><td className="px-4">{record.customer.name}</td><td className="px-4">{orderTypes(record)}</td><td className="whitespace-nowrap px-4 font-semibold text-navy">{money(record.total)}</td><td className="px-4"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass(record.status)}`}>{record.status}</span></td>{section.key === 'orders' && <td className="max-w-64 px-4"><span className="whitespace-nowrap font-semibold text-navy">{paymentStatusLabels[record.payment_status] || 'Belum dibayar'}</span><span className="mt-1 block whitespace-nowrap text-[10px] text-slate-500">{money(record.amount_paid || 0)} / {money(record.total)}</span>{(record.payments || []).map((payment) => <span key={payment.id} className="mt-1 block whitespace-nowrap text-[10px] text-slate-500">{payment.reference} · {payment.method === 'cash' ? 'Tunai' : payment.method} · {isoDate(payment.paid_at)}</span>)}</td>}{section.key === 'orders' && !isOrderSection && <td className="px-4">{renderActions(record)}</td>}</>}
                {isRental && <><td className="h-14 px-4 font-semibold text-navy">{order.id}</td><td className="px-4">{order.customer.name}</td><td className="max-w-56 px-4">{order.customer.villageAddress || '—'}</td><td className="px-4">{item.name}</td><td className="whitespace-nowrap px-4">{isoDate(`${item.startDate}T00:00:00`)}–{isoDate(`${item.returnDate}T00:00:00`)}</td><td className="px-4">{item.quantity}</td><td className="px-4"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass(order.status)}`}>{order.status}</span></td><td className="px-4">{order.source === 'customer-website' ? <span className="text-[11px] text-slate-400">Website</span> : renderActions(record)}</td></>}
                {section.key === 'customers' && <><td className="h-14 px-4 font-semibold text-navy">{record.name}</td><td className="px-4">{record.email}</td><td className="whitespace-nowrap px-4">{record.phone}</td><td className="whitespace-nowrap px-4">{isoDate(record.createdAt)}</td><td className="px-4">{customerOrders ?? '—'}</td><td className="px-4">{renderActions(record)}</td></>}
              </tr>
            })}
          </tbody>
        </table>
        {!count && !isApiSection && <div className="px-6 py-12 text-center"><PackageOpen size={28} className="mx-auto mb-3 text-slate-300" aria-hidden="true" /><p className="m-0 text-sm font-semibold text-navy">Data tidak ditemukan</p><p className="mb-0 mt-1 text-xs text-slate-500">Coba ubah kata pencarian atau filter.</p></div>}
      </div>
    </section>
    {!isApiSection && <p className="mb-0 mt-4 text-xs leading-relaxed text-slate-500">Data Admin adalah simulasi browser. Daftar penyewaan juga menampilkan pesanan sewa dari website yang tersimpan pada browser ini (hanya-baca); data tidak tersinkron ke perangkat atau pengguna lain.</p>}
    {dialog && <AdminRecordDialog key={`${section.key}-${dialog.record?.id || 'new'}`} section={section.key} record={dialog.record} products={viewData.products} categories={viewData.categories} customers={data.customers} onClose={() => setDialog(null)} onSave={save} />}
  </div>

  function renderActions(record) {
    const actionLabel = section.key === 'rentals' ? `${record.item.name} (${record.order.id})` : record.name || record.id
    if (section.key === 'customers' && !canEditCustomers) return <span className="text-[11px] text-slate-400">Admin</span>
    return <div className="flex items-center gap-1">
      <button type="button" aria-label={`Ubah ${actionLabel}`} onClick={() => setDialog({ record })} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-orange-50 hover:text-[#C94F08]"><Pencil size={15} aria-hidden="true" /></button>
      <button type="button" aria-label={`Hapus ${actionLabel}`} onClick={() => remove(record)} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={15} aria-hidden="true" /></button>
    </div>
  }
}
