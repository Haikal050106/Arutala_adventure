import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CalendarDays, Plus, Search, Trash2 } from 'lucide-react'
import CustomerPicker from '../../components/CustomerPicker'
import RentalPaymentPanel from '../../components/RentalPaymentPanel'
import StaticQrisDialog from '../../components/StaticQrisDialog'
import { adminApiRequest, readAdminToken } from '../../lib/admin-api'
import { money } from '../../lib/customer-shop'

const errorMessage = (error) => error instanceof Error ? error.message : 'Permintaan ke server gagal.'
const QRIS_IMAGE_KEY = 'arutala-pos-static-qris-image'
const dateOnly = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const today = dateOnly(new Date())
const tomorrow = dateOnly(new Date(Date.now() + 86400000))
const returnConditionLabels = { good: 'Baik', damaged: 'Rusak', lost: 'Hilang' }
const statusLabels = {
  pending_confirmation: 'Menunggu Konfirmasi',
  confirmed: 'Disetujui',
  active: 'Sedang Disewa',
  returned: 'Selesai',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
}
const paymentStatusLabels = { unpaid: 'Belum dibayar', partially_paid: 'Sebagian dibayar', paid: 'Lunas' }
const paymentMethodLabels = { cash: 'Tunai', qris: 'QRIS statis', gateway: 'Payment gateway' }
const nextStatuses = {
  pending_confirmation: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['active', 'cancelled'],
  active: ['returned'],
}

function rentalDays(startDate, returnDate) {
  return Math.round((new Date(`${returnDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / 86400000)
}

function overlapReserved(rentals, productId, startDate, returnDate) {
  const relevantItems = rentals
    .filter((rental) => rental.status === 'pending_confirmation' ||
      (['confirmed', 'active'].includes(rental.status) && !rental.stock_deducted))
    .flatMap((rental) => rental.rental_items || [])
    .filter((item) => item.product_id === productId && item.start_date < returnDate && item.return_date > startDate)
  const boundaries = [...new Set([startDate, ...relevantItems.map((item) => item.start_date)])].sort()
  return boundaries.reduce((peak, date) => Math.max(
    peak,
    relevantItems
      .filter((item) => item.start_date <= date && item.return_date > date)
      .reduce((sum, item) => sum + Number(item.quantity), 0),
  ), 0)
}

function apiCustomer(customer) {
  return { ...customer, village_name: customer.village_name || '' }
}

export default function AdminRentalsPage({ mode = 'all' }) {
  const { notify } = useOutletContext()
  const [rentals, setRentals] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedRentalId, setExpandedRentalId] = useState(null)
  const [customerId, setCustomerId] = useState('')
  const [villageName, setVillageName] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [returnDate, setReturnDate] = useState(tomorrow)
  const [notes, setNotes] = useState('')
  const [cart, setCart] = useState([])
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [returningRental, setReturningRental] = useState(null)
  const [returnConditions, setReturnConditions] = useState({})
  const [qrisImage] = useState(() => localStorage.getItem(QRIS_IMAGE_KEY) || '')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [qrisDialog, setQrisDialog] = useState(null)
  const requestInFlight = useRef(false)
  const statusRequestInFlight = useRef(false)

  const refreshData = useCallback(async () => {
    const token = readAdminToken()
    const [rentalRecords, productRecords, customerRecords] = await Promise.all([
      adminApiRequest('/rentals', { token }),
      adminApiRequest('/products', { token }),
      adminApiRequest('/customers', { token }),
    ])
    setRentals(rentalRecords)
    setProducts(productRecords)
    setCustomers(customerRecords.map(apiCustomer))
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        await refreshData()
      } catch (error) {
        if (active) setLoadError(errorMessage(error))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [refreshData])

  const validDates = Boolean(startDate && returnDate && returnDate > startDate)
  const days = validDates ? rentalDays(startDate, returnDate) : 0
  const visibleRentals = useMemo(() => rentals.filter((rental) => {
    const items = (rental.rental_items || []).map((item) => item.product?.name || '').join(' ')
    return (!statusFilter || rental.status === statusFilter) &&
      `${rental.rental_number} ${rental.customer?.name || ''} ${rental.customer?.email || ''} ${rental.village_name || ''} ${items}`
        .toLowerCase().includes(query.trim().toLowerCase())
  }), [rentals, query, statusFilter])
  const total = cart.reduce((sum, item) => sum + Number(item.product.rent_price_per_day) * item.quantity * days, 0)
  const cashChange = Math.max(0, Number(cashReceived || 0) - total)
  const cartHasAvailability = cart.every(({ product, quantity }) => (
    quantity <= Number(product.rental_stock) - overlapReserved(rentals, product.id, startDate, returnDate)
  ))
  const showBookingForm = mode !== 'history'
  const showRentalHistory = mode !== 'cashier'

  const selectCustomer = (id, customer) => {
    setCustomerId(id)
    if (customer) {
      setCustomers((current) => [...current.filter((item) => item.id !== customer.id), apiCustomer(customer)].sort((a, b) => a.name.localeCompare(b.name)))
      if (customer.village_name) setVillageName(customer.village_name)
    }
  }

  const availableUnits = (product) => {
    if (!validDates) return 0
    const reserved = overlapReserved(rentals, product.id, startDate, returnDate)
    const selected = cart.find((item) => item.product.id === product.id)?.quantity || 0
    return Math.max(0, Number(product.rental_stock) - reserved - selected)
  }

  const addProduct = (product) => {
    if (!validDates || availableUnits(product) < 1) return
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (existing) return current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { product, quantity: 1 }]
    })
  }

  const changeQuantity = (productId, delta) => {
    setCart((current) => current.map((item) => {
      if (item.product.id !== productId) return item
      const capacity = Math.max(0, Number(item.product.rental_stock) - overlapReserved(rentals, productId, startDate, returnDate))
      return { ...item, quantity: Math.min(capacity, item.quantity + delta) }
    }).filter((item) => item.quantity > 0))
  }

  const createRental = async (event) => {
    event.preventDefault()
    if (requestInFlight.current) return
    if (!customerId || !villageName.trim() || !validDates || !cart.length) {
      notify('Lengkapi pelanggan, alamat desa/kelurahan, tanggal sewa, dan minimal satu produk.', 'error')
      return
    }
    if (!cartHasAvailability) {
      notify('Jumlah unit melebihi ketersediaan pada tanggal yang dipilih. Periksa keranjang dan rentang sewa.', 'error')
      return
    }
    if (mode === 'cashier' && paymentMethod === 'cash' && Number(cashReceived || total) < total) {
      notify('Uang diterima tidak boleh kurang dari total pembayaran penyewaan.', 'error')
      return
    }
    if (mode === 'cashier' && paymentMethod === 'qris' && !qrisImage) {
      notify('QRIS statis belum tersedia. Unggah barcode toko melalui Kasir Penjualan pada perangkat ini.', 'error')
      return
    }

    requestInFlight.current = true
    setSaving(true)
    let createdRental
    try {
      createdRental = await adminApiRequest('/rentals', {
        method: 'POST',
        token: readAdminToken(),
        body: {
          rental: {
            customer_id: Number(customerId),
            village_name: villageName.trim(),
            notes: notes.trim(),
            items: cart.map(({ product, quantity }) => ({
              product_id: product.id,
              quantity,
              start_date: startDate,
              return_date: returnDate,
            })),
          },
        },
      })
    } catch (error) {
      let refreshFailed = false
      try {
        await refreshData()
      } catch {
        refreshFailed = true
      }
      notify(`Penyewaan gagal dipastikan: ${errorMessage(error)}.${refreshFailed ? ' Daftar transaksi juga gagal dimuat; muat ulang sebelum mencoba lagi.' : ' Daftar transaksi telah diperbarui; pastikan pesanan belum tercatat sebelum mencoba lagi.'}`, 'error')
      requestInFlight.current = false
      setSaving(false)
      return
    }

    setRentals((current) => [createdRental, ...current])
    setCart([])
    setCustomerId('')
    setVillageName('')
    setNotes('')
    setCashReceived('')

    if (mode !== 'cashier') {
      notify(`Penyewaan ${createdRental.rental_number} berhasil dibuat.`)
      try {
        await refreshData()
      } catch (error) {
        notify(`Penyewaan berhasil dibuat, tetapi data terbaru gagal dimuat: ${errorMessage(error)}`, 'error')
      }
      requestInFlight.current = false
      setSaving(false)
      return
    }

    let confirmedRental
    try {
      confirmedRental = await adminApiRequest(`/rentals/${createdRental.id}`, {
        method: 'PATCH',
        token: readAdminToken(),
        body: { rental: { status: 'confirmed' } },
      })
      setRentals((current) => current.map((rental) => rental.id === confirmedRental.id ? confirmedRental : rental))
    } catch (error) {
      notify(`Penyewaan ${createdRental.rental_number} tercatat, tetapi belum dapat disetujui: ${errorMessage(error)}. Periksa kembali pada Riwayat Penyewaan sebelum mencoba ulang.`, 'error')
      try {
        await refreshData()
      } catch (refreshError) {
        notify(`Penyewaan tercatat, persetujuan gagal, dan daftar penyewaan juga gagal dimuat: ${errorMessage(refreshError)}`, 'error')
      }
      requestInFlight.current = false
      setSaving(false)
      return
    }

    try {
      if (paymentMethod === 'cash') {
        if (Number(cashReceived || total) < Number(confirmedRental.balance_due)) {
          notify(`Total sewa ${createdRental.rental_number} berbeda dari estimasi. Booking sudah disetujui; catat pembayaran melalui antrean pembayaran di bawah.`, 'error')
        } else {
          const keyName = `arutala-payment-request-rental-cash-${confirmedRental.id}`
          let idempotencyKey = sessionStorage.getItem(keyName)
          if (!idempotencyKey) {
            idempotencyKey = crypto.randomUUID()
            sessionStorage.setItem(keyName, idempotencyKey)
          }
          const payment = await adminApiRequest(`/rentals/${confirmedRental.id}/payments`, {
            method: 'POST',
            token: readAdminToken(),
            idempotencyKey,
            body: {
              payment: {
                amount: confirmedRental.balance_due,
                cash_received: cashReceived || total,
                method: 'cash',
              },
            },
          })
          sessionStorage.removeItem(keyName)
          notify(`Penyewaan ${confirmedRental.rental_number} lunas. Pembayaran ${payment.reference} tercatat; kembalian ${money(payment.change_amount)}.`)
        }
      } else {
        const keyName = `arutala-payment-request-rental-qris-${confirmedRental.id}`
        let idempotencyKey = sessionStorage.getItem(keyName)
        if (!idempotencyKey) {
          idempotencyKey = crypto.randomUUID()
          sessionStorage.setItem(keyName, idempotencyKey)
        }
        const payment = await adminApiRequest(`/rentals/${confirmedRental.id}/payments`, {
          method: 'POST',
          token: readAdminToken(),
          idempotencyKey,
          body: { payment: { amount: confirmedRental.balance_due, method: 'qris' } },
        })
        sessionStorage.removeItem(keyName)
        setQrisDialog({ rental: confirmedRental, payment })
        notify(`Penyewaan ${confirmedRental.rental_number} menunggu verifikasi pembayaran QRIS.`)
      }
    } catch (error) {
      notify(`Penyewaan ${confirmedRental.rental_number} sudah disetujui, tetapi pembayaran belum tercatat: ${errorMessage(error)}. Gunakan antrean pembayaran di bawah untuk melanjutkan.`, 'error')
    }
    try {
      await refreshData()
    } catch (error) {
      notify(`Transaksi penyewaan berhasil diproses, tetapi daftar terbaru gagal dimuat: ${errorMessage(error)}`, 'error')
    } finally {
      requestInFlight.current = false
      setSaving(false)
    }
  }

  const updateStatus = async (rental, status, conditions = null) => {
    if (statusRequestInFlight.current) return
    if (status === 'rejected' && !window.confirm(`Tolak permintaan penyewaan ${rental.rental_number}?`)) return false
    statusRequestInFlight.current = true
    setUpdatingId(rental.id)
    try {
      const updatedRental = await adminApiRequest(`/rentals/${rental.id}`, {
        method: 'PATCH',
        token: readAdminToken(),
        body: { rental: {
          status,
          ...(conditions ? { return_conditions: conditions } : {}),
        } },
      })
      setRentals((current) => current.map((item) => item.id === updatedRental.id ? updatedRental : item))
      notify(`Status ${updatedRental.rental_number} diperbarui menjadi ${statusLabels[updatedRental.status] || updatedRental.status}.`)
      try {
        await refreshData()
      } catch (error) {
        notify(`Status berhasil diperbarui, tetapi stok terbaru gagal dimuat: ${errorMessage(error)}`, 'error')
      }
      return true
    } catch (error) {
      try {
        await refreshData()
      } catch {
        notify(`Status penyewaan gagal diperbarui dan daftar tidak dapat disegarkan: ${errorMessage(error)}`, 'error')
        setUpdatingId(null)
        return
      }
      notify(`Status penyewaan gagal diperbarui: ${errorMessage(error)}. Daftar terbaru telah dimuat.`, 'error')
      return false
    } finally {
      statusRequestInFlight.current = false
      setUpdatingId(null)
    }
  }

  const beginReturn = (rental) => {
    setReturningRental(rental)
    setReturnConditions(Object.fromEntries((rental.rental_items || []).map((item) => [
      item.id,
      Object.hasOwn(returnConditionLabels, item.return_condition) ? item.return_condition : '',
    ])))
  }

  const submitReturn = async (event) => {
    event.preventDefault()
    if (!returningRental) return
    const conditions = (returningRental.rental_items || []).map((item) => ({
      rental_item_id: item.id,
      condition: returnConditions[item.id] || '',
    }))
    const updated = await updateStatus(returningRental, 'returned', conditions)
    if (updated) setReturningRental(null)
  }

  const confirmCreatedRentalQris = async () => {
    const { rental, payment } = qrisDialog
    await adminApiRequest(`/rentals/${rental.id}/payments/${payment.id}/confirm`, {
      method: 'POST',
      token: readAdminToken(),
    })
    setQrisDialog(null)
    try {
      await refreshData()
      notify(`Pembayaran QRIS ${payment.reference} dikonfirmasi dan dicatat lunas.`)
    } catch (error) {
      notify(`Pembayaran QRIS ${payment.reference} sudah dikonfirmasi, tetapi daftar penyewaan gagal dimuat ulang: ${errorMessage(error)}`, 'error')
    }
  }

  const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { dateStyle: 'medium' })
  const formatDateTime = (date) => new Date(date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  const lateDays = (date, comparisonDate = today) => Math.max(0, Math.floor((new Date(`${comparisonDate}T00:00:00`) - new Date(`${date}T00:00:00`)) / 86400000))
  const selectedRental = rentals.find((rental) => rental.id === expandedRentalId)

  return <div>
    <div className="mb-6">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{mode === 'cashier' ? 'Area Kasir · Penyewaan' : 'Area Kasir/Admin · Penyewaan'}</p>
      <h1 className="m-0 text-2xl font-bold tracking-tight text-navy max-sm:text-xl">{mode === 'cashier' ? 'Kasir Penyewaan' : mode === 'history' ? 'Riwayat Penyewaan' : 'Penyewaan'}</h1>
      <p className="mb-0 mt-2 text-sm text-slate-600">{mode === 'cashier' ? 'Pilih pelanggan, perlengkapan, periode sewa, lalu catat pembayaran.' : 'Kelola booking pelanggan, detail transaksi, serah-terima, dan pengembalian melalui server.'}</p>
    </div>

    {loadError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Data penyewaan gagal dimuat: {loadError}</p>}

    {showBookingForm && <form onSubmit={createRental} className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm max-sm:p-3.5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-sm font-semibold text-navy">Pilih perlengkapan sewa</h2>
          <label className="relative min-w-[190px] flex-1 sm:max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari produk..." aria-label="Cari produk sewa" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label>
        </div>
        {!validDates && <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Tanggal kembali harus setelah tanggal mulai.</p>}
        {products.filter((product) => `${product.name} ${product.category?.name || ''}`.toLowerCase().includes(query.trim().toLowerCase())).map((product) => {
          const available = availableUnits(product)
          return <button type="button" key={product.id} disabled={!validDates || available < 1} onClick={() => addProduct(product)} className="mb-3 mr-3 inline-flex w-[calc(50%-0.5rem)] flex-col rounded-xl border border-slate-200 p-3 text-left transition hover:border-primary/50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 sm:w-[calc(33.333%-0.75rem)] xl:w-[calc(25%-0.75rem)]">
            <span className="block truncate text-[10px] text-slate-500">{product.category?.name || 'Produk'}</span>
            <strong className="mt-1 block min-h-9 text-xs leading-snug text-navy">{product.name}</strong>
            <span className="mt-2 block text-sm font-bold text-secondary">{money(product.rent_price_per_day)}<small className="ml-1 text-[10px] font-medium text-slate-500">/ hari</small></span>
            <span className="mt-2 block text-[10px] font-medium text-slate-500">Tersedia untuk tanggal ini: {available}</span>
          </button>
        })}
        {!products.length && !loading && <p className="py-10 text-center text-sm text-slate-500">Belum ada produk yang tersedia dari server.</p>}
        {!loading && products.length > 0 && !products.some((product) => `${product.name} ${product.category?.name || ''}`.toLowerCase().includes(query.trim().toLowerCase())) && <p className="py-10 text-center text-sm text-slate-500">Produk tidak ditemukan.</p>}
      </section>

      <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-20">
        <div className="bg-navy px-5 py-4 text-white"><h2 className="m-0 text-base font-semibold">Transaksi sewa</h2><p className="mb-0 mt-1 text-xs text-slate-300">Server memvalidasi ketersediaan dan biaya.</p></div>
        <div className="space-y-4 p-5">
          <CustomerPicker customers={customers} value={customerId} onChange={selectCustomer} />
          <label className="block text-xs font-semibold text-navy">Desa/Kelurahan<input required maxLength={150} value={villageName} onChange={(event) => setVillageName(event.target.value)} placeholder="Nama desa/kelurahan" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-navy">Mulai sewa<input required type="date" min={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-2 text-xs font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label>
            <label className="block text-xs font-semibold text-navy">Tanggal kembali<input required type="date" min={startDate || today} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-2 text-xs font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label>
          </div>
          <label className="block text-xs font-semibold text-navy">Catatan (opsional)<textarea maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label>
          <div className="max-h-52 overflow-auto border-y border-slate-100 py-2">
            {cart.map(({ product, quantity }) => <div key={product.id} className="flex items-start gap-3 py-2">
              <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-navy">{product.name}</strong><span className="mt-1 block text-[11px] text-slate-500">{money(product.rent_price_per_day)} × {quantity} unit × {days} hari · Subtotal {money(Number(product.rent_price_per_day) * quantity * days)}</span>
                <div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => changeQuantity(product.id, -1)} aria-label={`Kurangi ${product.name}`} className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-600"><span aria-hidden="true">−</span></button><span className="min-w-5 text-center text-xs font-semibold">{quantity}</span><button type="button" disabled={availableUnits(product) < 1} onClick={() => changeQuantity(product.id, 1)} aria-label={`Tambah ${product.name}`} className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-40"><Plus size={13} /></button></div>
              </div>
              <button type="button" onClick={() => setCart((current) => current.filter((item) => item.product.id !== product.id))} aria-label={`Hapus ${product.name}`} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
            </div>)}
            {!cart.length && <div className="grid min-h-16 place-items-center text-center text-xs text-slate-500">Pilih produk untuk memulai.</div>}
          </div>
          <div className="flex items-center justify-between text-sm text-slate-600"><span>Durasi {days || 0} hari · Total</span><strong className="text-lg font-bold text-navy">{money(total)}</strong></div>
          {mode === 'cashier' && <>
            <label className="block text-xs font-semibold text-navy">Metode pembayaran
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25">
                <option value="cash">Tunai (Cash)</option>
                <option value="qris">QRIS statis</option>
              </select>
            </label>
            {paymentMethod === 'cash'
              ? <div>
                <label className="block text-xs font-semibold text-navy">Uang diterima
                  <input required type="number" min={total} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
                </label>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><span>Kembalian</span><strong className="text-sm text-navy">{money(cashChange)}</strong></div>
                {Number(cashReceived || 0) < total && <p role="alert" className="mb-0 mt-2 text-xs text-red-700">Uang diterima tidak boleh kurang dari total pembayaran.</p>}
              </div>
              : <div className="rounded-lg border border-[#E8D6CE] bg-[#FBF6F3] p-3 text-xs text-secondary">
                <p className="m-0 font-semibold">Nominal QRIS: {money(total)}</p>
                {qrisImage
                  ? <img src={qrisImage} alt="QRIS statis toko" className="mx-auto mt-3 max-h-40 w-full rounded-md bg-white object-contain p-2" />
                  : <p role="alert" className="mb-0 mt-2 text-red-700">QRIS toko belum tersedia. Unggah barcode melalui Kasir Penjualan pada perangkat ini.</p>}
                <p className="mb-0 mt-2">Pembayaran akan berstatus Pending sampai kasir memeriksa dana masuk dan mengonfirmasi.</p>
              </div>}
          </>}
          <button type="submit" disabled={saving || loading || !cart.length || !validDates || !cartHasAvailability || !customerId || !villageName.trim() || mode === 'cashier' && paymentMethod === 'cash' && Number(cashReceived || 0) < total || mode === 'cashier' && paymentMethod === 'qris' && !qrisImage} className="h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-secondary transition hover:bg-secondary hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Memproses penyewaan...' : mode !== 'cashier' ? 'Buat transaksi sewa' : paymentMethod === 'qris' ? 'Buat penyewaan & QRIS · Pending' : 'Buat penyewaan & catat tunai'}
          </button>
        </div>
      </aside>
    </form>}

    {showRentalHistory && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div><h2 className="m-0 text-sm font-semibold text-navy">Daftar penyewaan</h2><p className="mb-0 mt-1 text-xs text-slate-500">{visibleRentals.length} transaksi · data API</p></div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:justify-end">
          <label className="relative min-w-[190px] flex-1 sm:max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari transaksi..." aria-label="Cari transaksi sewa" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label>
          <label className="sr-only" htmlFor="rental-status-filter">Filter status penyewaan</label>
          <select id="rental-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25">
            <option value="">Semua status</option>
            {Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
          </select>
        </div>
      </div>
      {loading ? <p className="p-8 text-center text-sm text-slate-500">Memuat penyewaan dari server...</p> : loadError ? null : <div className="overflow-x-auto">
        <table className="w-full min-w-[1150px] border-collapse text-left">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><tr>{['Nomor sewa', 'Pelanggan', 'Desa/Kelurahan', 'Perlengkapan', 'Periode', 'Total', 'Status', 'Pembayaran', 'Aksi'].map((column) => <th key={column} className="h-11 whitespace-nowrap px-4">{column}</th>)}</tr></thead>
          <tbody>{visibleRentals.map((rental) => <tr key={rental.id} className="border-t border-slate-100 text-xs text-slate-600">
            <td className="h-14 whitespace-nowrap px-4 font-semibold text-navy">{rental.rental_number}</td>
            <td className="px-4"><span className="block font-medium text-navy">{rental.customer?.name || '—'}</span><span className="mt-1 block text-[10px]">{rental.customer?.email || ''}</span></td>
            <td className="px-4">{rental.village_name}</td>
            <td className="max-w-56 px-4">{(rental.rental_items || []).map((item) => `${item.product?.name || 'Produk'} × ${item.quantity}`).join(', ')}</td>
            <td className="whitespace-nowrap px-4">{(rental.rental_items || []).map((item) => `${formatDate(item.start_date)}–${formatDate(item.return_date)}`).join(', ')}</td>
            <td className="whitespace-nowrap px-4 font-semibold text-navy">{money(rental.total_amount)}</td>
            <td className="px-4"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${rental.status === 'returned' ? 'bg-emerald-50 text-emerald-700' : ['cancelled', 'rejected'].includes(rental.status) ? 'bg-slate-100 text-slate-600' : rental.status === 'active' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>{rental.display_status || statusLabels[rental.status] || rental.status}</span></td>
            <td className="px-4"><span className="whitespace-nowrap font-semibold text-navy">{paymentStatusLabels[rental.payment_status] || 'Belum dibayar'}</span><span className="mt-1 block whitespace-nowrap text-[10px] text-slate-500">{money(rental.amount_paid || 0)} / {money(rental.total_amount)}</span></td>
            <td className="px-4"><div className="flex items-center gap-2">
              <button type="button" onClick={() => setExpandedRentalId((current) => current === rental.id ? null : rental.id)} aria-expanded={expandedRentalId === rental.id} className="h-8 whitespace-nowrap rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{expandedRentalId === rental.id ? 'Tutup detail' : 'Detail'}</button>
              {(nextStatuses[rental.status] || []).filter((status) => status !== 'active' || rental.payment_status === 'paid').length > 0 && <select aria-label={`Ubah status ${rental.rental_number}`} disabled={updatingId !== null} value="" onChange={(event) => { if (event.target.value === 'returned') beginReturn(rental); else if (event.target.value) updateStatus(rental, event.target.value) }} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600 disabled:opacity-50"><option value="">Ubah status</option>{nextStatuses[rental.status].filter((status) => status !== 'active' || rental.payment_status === 'paid').map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>}
            </div></td>
          </tr>)}
          {!visibleRentals.length && <tr><td colSpan={9} className="h-20 text-center text-sm text-slate-500">Tidak ada transaksi yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>}
      {selectedRental && <div className="border-t border-slate-100 bg-slate-50 p-5">
        <h3 className="m-0 text-sm font-semibold text-navy">Detail {selectedRental.rental_number}</h3>
        <div className="mt-3 grid gap-4 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="mb-1 font-semibold text-navy">Pelanggan</p><p className="m-0">{selectedRental.customer?.name || '—'}</p><p className="m-0">{selectedRental.customer?.email || '—'}</p><p className="m-0">{selectedRental.customer?.phone || '—'}</p><p className="m-0">Desa/Kelurahan: {selectedRental.village_name || '—'}</p></div>
          <div><p className="mb-1 font-semibold text-navy">Booking</p><p className="m-0">Dibuat: {formatDateTime(selectedRental.created_at)}</p><p className="m-0">Status: {selectedRental.display_status || statusLabels[selectedRental.status] || selectedRental.status}</p><p className="m-0">Total: {money(selectedRental.total_amount)}</p>{selectedRental.actual_returned_at && <p className="m-0">Dikembalikan aktual: {formatDateTime(selectedRental.actual_returned_at)}</p>}</div>
          <div><p className="mb-1 font-semibold text-navy">Catatan booking</p><p className="m-0 whitespace-pre-wrap">{selectedRental.notes || 'Tidak ada catatan.'}</p></div>
        </div>
        <div className="mt-4 space-y-3">
          {(selectedRental.rental_items || []).map((item) => {
            const comparisonDate = selectedRental.status === 'returned' && selectedRental.actual_returned_at
              ? dateOnly(new Date(selectedRental.actual_returned_at))
              : today
            const overdue = ['active', 'returned'].includes(selectedRental.status)
              ? lateDays(item.return_date, comparisonDate)
              : 0
            return <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <p className="m-0 font-semibold text-navy">{item.product?.name || 'Produk'} · {item.quantity} unit</p>
              <p className="mb-0 mt-1">Mulai: {formatDate(item.start_date)} · Tanggal pengembalian: {formatDate(item.return_date)} · Durasi: {item.rental_days} hari</p>
              {overdue > 0 && <p className="mb-0 mt-1 font-semibold text-red-700">{selectedRental.status === 'returned' ? 'Dikembalikan terlambat' : 'Terlambat'} {overdue} hari. Denda belum diterapkan karena aturan denda belum tersedia.</p>}
              {selectedRental.status === 'returned' && <p className="mb-0 mt-1">Kondisi saat dikembalikan: {returnConditionLabels[item.return_condition] || item.return_condition || 'Tidak tercatat.'}</p>}
            </div>
          })}
        </div>
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="m-0 text-xs font-semibold text-navy">Riwayat pembayaran · {paymentStatusLabels[selectedRental.payment_status] || 'Belum dibayar'}</h4>
            {Number(selectedRental.balance_due ?? selectedRental.total_amount) > 0 && selectedRental.status === 'confirmed' && <p className="mb-0 text-[11px] text-slate-500">Pembayaran tunai/QRIS dicatat melalui POS.</p>}
          </div>
          {selectedRental.payments?.length
            ? <ol className="mb-0 mt-2 space-y-2 pl-5 text-xs text-slate-600">{selectedRental.payments.map((payment) => <li key={payment.id}>{payment.reference} · {paymentMethodLabels[payment.method] || payment.method} · {money(payment.amount)} · {payment.status === 'pending' ? 'Menunggu konfirmasi kasir' : payment.status === 'succeeded' ? formatDateTime(payment.paid_at) : payment.status}</li>)}</ol>
            : <p className="mb-0 mt-2 text-xs text-slate-500">Belum ada pembayaran tercatat.</p>}
        </div>
        <div className="mt-4">
          <h4 className="m-0 text-xs font-semibold text-navy">Riwayat status</h4>
          {selectedRental.status_histories?.length
            ? <ol className="mb-0 mt-2 space-y-2 pl-5 text-xs text-slate-600">{selectedRental.status_histories.map((history) => <li key={history.id}>{history.from_status ? `${statusLabels[history.from_status] || history.from_status} → ` : 'Booking dibuat → '}{statusLabels[history.to_status] || history.to_status} · {formatDateTime(history.created_at)}{history.changed_by ? ` · ${history.changed_by}` : ' · pelanggan/sistem'}</li>)}</ol>
            : <p className="mb-0 mt-2 text-xs text-slate-500">Riwayat transisi status belum tersedia untuk booking ini.</p>}
        </div>
      </div>}
    </section>}
    {mode !== 'history' && <p className="mb-0 mt-4 flex items-center gap-2 text-xs leading-relaxed text-slate-500"><CalendarDays size={14} aria-hidden="true" />Rentang sewa menggunakan tanggal kembali eksklusif. Serah-terima hanya dapat dilakukan setelah tagihan lunas.</p>}
    {returningRental && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4" role="presentation">
      <form onSubmit={submitReturn} role="dialog" aria-modal="true" aria-labelledby="rental-return-title" className="my-auto w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h2 id="rental-return-title" className="m-0 text-lg font-semibold text-navy">Proses pengembalian</h2>
        <p className="mb-4 mt-2 text-xs text-slate-600">Catat kondisi setiap barang sebelum menyelesaikan pengembalian {returningRental.rental_number}.</p>
        <div className="max-h-[55vh] space-y-3 overflow-auto">
          {(returningRental.rental_items || []).map((item) => <label key={item.id} className="block text-xs font-semibold text-navy">{item.product?.name || 'Produk'} · {item.quantity} unit
            <select required value={returnConditions[item.id] || ''} onChange={(event) => setReturnConditions((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25">
              <option value="">Pilih kondisi barang</option>
              {Object.entries(returnConditionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>)}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={updatingId !== null} onClick={() => setReturningRental(null)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">Batal</button>
          <button type="submit" disabled={updatingId !== null || Object.values(returnConditions).some((condition) => !condition.trim())} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-secondary disabled:cursor-not-allowed disabled:opacity-50">{updatingId === returningRental.id ? 'Menyimpan...' : 'Selesaikan pengembalian'}</button>
        </div>
      </form>
    </div>}
    <RentalPaymentPanel notify={notify} qrisImage={qrisImage} />
    {qrisDialog && <StaticQrisDialog
      transactionNumber={qrisDialog.rental.rental_number}
      amount={qrisDialog.payment.amount}
      qrImage={qrisImage}
      payment={qrisDialog.payment}
      onClose={() => setQrisDialog(null)}
      onConfirm={confirmCreatedRentalQris}
    />}
  </div>
}
