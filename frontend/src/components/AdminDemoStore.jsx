import { useEffect, useState } from 'react'
import { customerProducts } from '../data/customer-products'
import { AdminDemoContext } from './useAdminDemoStore'

const STORAGE_KEY = 'arutala-admin-demo-data'

const sampleCustomers = [
  { id: 'cust-nadia', name: 'Nadia Putri', email: 'nadia@example.test', phone: '081234567801', createdAt: '2026-09-10T09:00:00.000Z' },
  { id: 'cust-bima', name: 'Bima Pratama', email: 'bima@example.test', phone: '081234567802', createdAt: '2026-09-12T09:00:00.000Z' },
  { id: 'cust-salsa', name: 'Salsa Ayu', email: 'salsa@example.test', phone: '081234567803', createdAt: '2026-09-14T09:00:00.000Z' },
  { id: 'cust-rizky', name: 'Rizky Maulana', email: 'rizky@example.test', phone: '081234567804', createdAt: '2026-09-16T09:00:00.000Z' },
]

const products = customerProducts.map((product) => ({ ...product }))
const productById = Object.fromEntries(products.map((product) => [product.id, product]))

function makeItem(productId, kind, quantity, dates = {}) {
  const product = productById[productId]
  const rentalDays = kind === 'rental' ? 3 : 0
  return {
    id: `${kind}-${productId}`,
    productId,
    name: product.name,
    category: product.category,
    kind,
    quantity,
    unitPrice: kind === 'rental' ? product.rentPricePerDay : product.salePrice,
    startDate: dates.startDate || '',
    returnDate: dates.returnDate || '',
    rentalDays,
  }
}

const sampleOrders = [
  { id: 'AA-26001', createdAt: '2026-10-28T08:30:00.000Z', customer: { name: 'Nadia Putri', email: 'nadia@example.test', phone: '081234567801' }, items: [makeItem('tenda-eiger-xtrail-2p', 'rental', 1, { startDate: '2026-10-28', returnDate: '2026-10-31' })], total: 255000, status: 'Dikonfirmasi', paymentStatus: 'Belum dibayar', prototype: true },
  { id: 'AA-26002', createdAt: '2026-10-27T10:15:00.000Z', customer: { name: 'Bima Pratama', email: 'bima@example.test', phone: '081234567802' }, items: [makeItem('carrier-consina-60l', 'purchase', 1)], total: 1250000, status: 'Diproses', paymentStatus: 'Belum dibayar', prototype: true },
  { id: 'AA-26003', createdAt: '2026-10-26T14:00:00.000Z', customer: { name: 'Salsa Ayu', email: 'salsa@example.test', phone: '081234567803' }, items: [makeItem('sleeping-bag-polar', 'rental', 2, { startDate: '2026-10-29', returnDate: '2026-11-01' })], total: 180000, status: 'Menunggu konfirmasi', paymentStatus: 'Belum dibayar', prototype: true },
  { id: 'AA-26004', createdAt: '2026-10-25T09:20:00.000Z', customer: { name: 'Rizky Maulana', email: 'rizky@example.test', phone: '081234567804' }, items: [makeItem('sepatu-hiking-arei', 'purchase', 1)], total: 875000, status: 'Selesai', paymentStatus: 'Lunas', prototype: true },
]

const initialAdminDemoData = {
  products,
  categories: [
    { id: 'cat-tenda', name: 'Tenda', description: 'Tenda dan perlindungan saat berkemah.' },
    { id: 'cat-carrier', name: 'Tas & Carrier', description: 'Tas dan carrier untuk perjalanan.' },
    { id: 'cat-footwear', name: 'Alas Kaki', description: 'Sepatu dan alas kaki kegiatan luar ruang.' },
    { id: 'cat-cooking', name: 'Alat Masak', description: 'Peralatan memasak di alam terbuka.' },
    { id: 'cat-comfort', name: 'Kenyamanan', description: 'Perlengkapan istirahat dan kenyamanan.' },
    { id: 'cat-accessories', name: 'Aksesori', description: 'Aksesori pendukung kegiatan outdoor.' },
  ],
  customers: sampleCustomers,
  orders: sampleOrders,
}

function readStoredData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return initialAdminDemoData
    const parsed = JSON.parse(stored)
    if (!parsed || !['products', 'categories', 'customers', 'orders'].every((key) => Array.isArray(parsed[key]))) {
      throw new Error('Format data demo Admin tidak valid.')
    }
    return parsed
  } catch (error) {
    console.error('Data demo Admin tidak dapat dibaca dari penyimpanan lokal.', error)
    return initialAdminDemoData
  }
}

export function AdminDemoProvider({ children }) {
  const [data, setData] = useState(readStoredData)
  const [storageError, setStorageError] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setStorageError('')
    } catch (error) {
      console.error('Data demo Admin tidak dapat disimpan ke penyimpanan lokal.', error)
      setStorageError('Perubahan hanya tersimpan sementara di sesi ini karena penyimpanan browser tidak tersedia.')
    }
  }, [data])

  return <AdminDemoContext.Provider value={{ data, setData, storageError }}>{children}</AdminDemoContext.Provider>
}
