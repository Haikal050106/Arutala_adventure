import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CalendarDays, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import CashPaymentDialog from '../../components/CashPaymentDialog'
import CustomerPicker from '../../components/CustomerPicker'
import StaticQrisDialog from '../../components/StaticQrisDialog'
import { adminApiRequest, readAdminToken } from '../../lib/admin-api'
import { money } from '../../lib/customer-shop'
import AdminRentalsPage from './AdminRentalsPage'

const errorMessage = (error) => error instanceof Error ? error.message : 'Permintaan ke server gagal.'
const dateLabel = (date) => new Date(date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
const statusLabels = {
  pending_confirmation: 'Menunggu konfirmasi',
  confirmed: 'Dikonfirmasi',
  processing: 'Diproses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}
const paymentStatusLabels = { unpaid: 'Belum dibayar', partially_paid: 'Sebagian dibayar', paid: 'Lunas' }
const paymentMethodLabels = { cash: 'Tunai', qris: 'QRIS statis', gateway: 'Payment gateway' }
const QRIS_IMAGE_KEY = 'arutala-pos-static-qris-image'

export default function AdminPOSPage() {
  const { notify } = useOutletContext()
  const [activeTab, setActiveTab] = useState('sales')
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [cart, setCart] = useState([])
  const [saving, setSaving] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [paymentDialog, setPaymentDialog] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [qrisImage, setQrisImage] = useState(() => localStorage.getItem(QRIS_IMAGE_KEY) || '')
  const [qrisImageError, setQrisImageError] = useState('')
  const [qrisPaymentDialog, setQrisPaymentDialog] = useState(null)

  const refreshData = useCallback(async () => {
    const token = readAdminToken()
    const [orderRecords, productRecords, customerRecords] = await Promise.all([
      adminApiRequest('/orders', { token }),
      adminApiRequest('/products', { token }),
      adminApiRequest('/customers', { token }),
    ])
    setOrders(orderRecords)
    setProducts(productRecords)
    setCustomers(customerRecords)
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

  const visibleProducts = useMemo(() => products.filter((product) => {
    const searchText = `${product.name} ${product.category?.name || ''}`.toLowerCase()
    return searchText.includes(query.trim().toLowerCase())
  }), [products, query])
  const total = cart.reduce((sum, item) => sum + Number(item.product.sale_price) * item.quantity, 0)

  const selectCustomer = (id, customer) => {
    setCustomerId(id)
    if (customer) setCustomers((current) => [...current.filter((item) => item.id !== customer.id), customer].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const openPaymentDialog = (order) => {
    const keyName = `arutala-payment-request-order-${order.id}`
    let idempotencyKey = sessionStorage.getItem(keyName)
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID()
      sessionStorage.setItem(keyName, idempotencyKey)
    }
    setPaymentDialog({ ...order, idempotencyKey, keyName })
  }

  const recordCashPayment = async (order, received, idempotencyKey, keyName) => {
    const payment = await adminApiRequest(`/orders/${order.id}/payments`, {
      method: 'POST',
      token: readAdminToken(),
      idempotencyKey,
      body: { payment: { amount: order.balance_due ?? order.total_amount, cash_received: received } },
    })
    sessionStorage.removeItem(keyName)
    setOrders((current) => current.map((item) => item.id === order.id
      ? {
          ...item,
          payments: [...(item.payments || []).filter((entry) => entry.id !== payment.id), payment],
          amount_paid: Number(item.amount_paid || 0) + Number(payment.amount),
          balance_due: Math.max(0, Number(item.balance_due ?? item.total_amount) - Number(payment.amount)),
          payment_status: Number(item.balance_due ?? item.total_amount) <= Number(payment.amount) ? 'paid' : 'partially_paid',
        }
      : item))
    try {
      await refreshData()
    } catch (error) {
      notify(`Pembayaran berhasil dicatat, tetapi daftar terbaru gagal dimuat: ${errorMessage(error)}`, 'error')
    }
    notify(`Pembayaran ${payment.reference} berhasil dicatat. Kembalian ${money(payment.change_amount)}.`)
    return true
  }

  const saveQrisImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setQrisImageError('Pilih gambar QRIS berformat PNG, JPG, atau WebP.')
      event.target.value = ''
      return
    }
    if (file.size > 1_500_000) {
      setQrisImageError('Ukuran gambar QRIS maksimal 1,5 MB.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      try {
        if (typeof reader.result !== 'string') throw new Error('Berkas gambar tidak dapat dibaca.')
        localStorage.setItem(QRIS_IMAGE_KEY, reader.result)
        setQrisImage(reader.result)
        setQrisImageError('')
      } catch (error) {
        setQrisImageError(errorMessage(error))
      }
    }
    reader.onerror = () => setQrisImageError('Berkas gambar QRIS gagal dibaca.')
    reader.readAsDataURL(file)
  }

  const startQrisPayment = async (order) => {
    const keyName = `arutala-payment-request-qris-order-${order.id}`
    let idempotencyKey = sessionStorage.getItem(keyName)
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID()
      sessionStorage.setItem(keyName, idempotencyKey)
    }
    const payment = await adminApiRequest(`/orders/${order.id}/payments`, {
      method: 'POST',
      token: readAdminToken(),
      idempotencyKey,
      body: { payment: { amount: order.balance_due ?? order.total_amount, method: 'qris' } },
    })
    sessionStorage.removeItem(keyName)
    setOrders((current) => current.map((item) => item.id === order.id
      ? {
          ...item,
          payments: [...(item.payments || []).filter((entry) => entry.id !== payment.id), payment],
        }
      : item))
    setQrisPaymentDialog({ order, payment, qrImage: qrisImage })
    try {
      await refreshData()
    } catch (error) {
      notify(`QRIS tercatat sebagai Pending, tetapi riwayat gagal dimuat: ${errorMessage(error)}`, 'error')
    }
  }

  const confirmQrisPayment = async (order, payment) => {
    await adminApiRequest(`/orders/${order.id}/payments/${payment.id}/confirm`, {
      method: 'POST',
      token: readAdminToken(),
    })
    setQrisPaymentDialog(null)
    try {
      await refreshData()
    } catch (error) {
      notify(`Pembayaran QRIS berhasil dicatat Paid, tetapi riwayat gagal dimuat: ${errorMessage(error)}`, 'error')
      return
    }
    notify(`Pembayaran QRIS ${payment.reference} berhasil dikonfirmasi dan dicatat Paid.`)
  }

  const cancelPendingQrisOrder = async (order) => {
    if (!window.confirm(`Batalkan transaksi ${order.order_number} yang pembayarannya masih Pending?`)) return
    try {
      await adminApiRequest(`/orders/${order.id}`, {
        method: 'PATCH',
        token: readAdminToken(),
        body: { order: { status: 'cancelled' } },
      })
      await refreshData()
      notify(`Transaksi ${order.order_number} dibatalkan. Stok mengikuti pembatalan transaksi.`)
    } catch (error) {
      notify(errorMessage(error), 'error')
    }
  }

  const addProduct = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (existing) {
        if (existing.quantity >= Number(product.sale_stock)) return current
        return current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      if (Number(product.sale_stock) <= 0) return current
      return [...current, { product, quantity: 1 }]
    })
  }

  const updateQuantity = (productId, delta) => {
    setCart((current) => current
      .map((item) => item.product.id === productId
        ? { ...item, quantity: Math.min(Number(item.product.sale_stock), item.quantity + delta) }
        : item)
      .filter((item) => item.quantity > 0))
  }

  const processSale = async () => {
    if (saving) return
    if (!customerId) {
      notify('Pilih pelanggan sebelum memproses penjualan.', 'error')
      return
    }
    if (!cart.length) {
      notify('Tambahkan minimal satu produk ke transaksi.', 'error')
      return
    }
    if (paymentMethod === 'cash' && (!Number.isFinite(Number(cashReceived)) || Number(cashReceived) < total)) {
      notify('Uang diterima harus minimal sebesar total transaksi.', 'error')
      return
    }
    if (paymentMethod === 'qris' && !qrisImage) {
      notify('Unggah gambar QRIS statis toko sebelum memproses pembayaran QRIS.', 'error')
      return
    }

    setSaving(true)
    try {
      const createdOrder = await adminApiRequest('/orders', {
        method: 'POST',
        token: readAdminToken(),
        body: {
          order: {
            customer_id: Number(customerId),
            items: cart.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
          },
        },
      })
      setOrders((current) => [createdOrder, ...current])

      let confirmedOrder
      try {
        confirmedOrder = await adminApiRequest(`/orders/${createdOrder.id}`, {
          method: 'PATCH',
          token: readAdminToken(),
          body: { order: { status: 'confirmed' } },
        })
      } catch (error) {
        notify(`Transaksi ${createdOrder.order_number} tercatat sebagai menunggu konfirmasi, tetapi stok belum dikurangi: ${errorMessage(error)}`, 'error')
        return
      }

      setOrders((current) => current.map((order) => order.id === confirmedOrder.id ? confirmedOrder : order))
      setCart([])
      setCustomerId('')
      setCashReceived('')
      if (paymentMethod === 'qris') {
        try {
          await startQrisPayment(confirmedOrder)
          notify(`Transaksi ${confirmedOrder.order_number} menunggu verifikasi pembayaran QRIS.`)
        } catch (error) {
          notify(`Transaksi ${confirmedOrder.order_number} tercatat, tetapi QRIS belum tercatat: ${errorMessage(error)}`, 'error')
        }
        return
      }
      try {
        const keyName = `arutala-payment-request-order-${confirmedOrder.id}`
        const idempotencyKey = sessionStorage.getItem(keyName) || crypto.randomUUID()
        sessionStorage.setItem(keyName, idempotencyKey)
        await recordCashPayment(confirmedOrder, cashReceived, idempotencyKey, keyName)
      } catch (error) {
        openPaymentDialog({ ...confirmedOrder, balance_due: Number(confirmedOrder.balance_due ?? confirmedOrder.total_amount) })
        notify(`Penjualan ${confirmedOrder.order_number} tercatat dan stok telah diproses, tetapi pembayaran belum tercatat: ${errorMessage(error)}`, 'error')
        return
      }
      try {
        await refreshData()
        notify(`Penjualan ${confirmedOrder.order_number} berhasil diproses.`)
      } catch (error) {
        notify(`Penjualan berhasil diproses, tetapi daftar terbaru gagal dimuat: ${errorMessage(error)}`, 'error')
      }
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  return <div>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Area Kasir</p>
        <h1 className="m-0 text-2xl font-bold tracking-tight text-navy max-sm:text-xl">Kasir (POS)</h1>
        <p className="mb-0 mt-2 text-sm text-slate-600">Pilih kasir penjualan, kasir penyewaan, atau riwayat transaksi sewa.</p>
      </div>
      {activeTab === 'sales' && <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm"><ShoppingCart size={15} className="text-primary" aria-hidden="true" />{cart.reduce((sum, item) => sum + item.quantity, 0)} unit di keranjang</span>}
    </div>

    <div className="mb-5 flex gap-2 border-b border-slate-200" role="tablist" aria-label="Jenis transaksi kasir">
      {[
        { tab: 'sales', label: 'Kasir Penjualan', icon: <ShoppingCart size={16} aria-hidden="true" /> },
        { tab: 'rentals', label: 'Kasir Penyewaan', icon: <CalendarDays size={16} aria-hidden="true" /> },
      ].map(({ tab, label, icon }) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={`pos-tab-${tab}`}
          aria-selected={activeTab === tab}
          aria-controls={`pos-panel-${tab}`}
          onClick={() => setActiveTab(tab)}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? 'border-primary text-secondary' : 'border-transparent text-slate-500 hover:text-navy'}`}
        >
          {icon}{label}
        </button>
      ))}
      <Link
        to="/admin/rentals"
        className="inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-slate-500 transition hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <CalendarDays size={16} aria-hidden="true" />Riwayat Penyewaan
      </Link>
    </div>

    {activeTab === 'sales' && <div id="pos-panel-sales" role="tabpanel" aria-labelledby="pos-tab-sales">
    {loadError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Data penjualan gagal dimuat: {loadError}</p>}
    {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Memuat produk dan transaksi dari server...</div> : !loadError && <>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm max-sm:p-3.5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-sm font-semibold text-navy">Pilih produk untuk dijual</h2>
            <label className="relative min-w-[190px] flex-1 sm:max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari produk..." aria-label="Cari produk" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label>
          </div>
          {visibleProducts.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
            {visibleProducts.map((product) => <button type="button" key={product.id} disabled={Number(product.sale_stock) < 1} onClick={() => addProduct(product)} className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-primary/50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
              <span className="block truncate text-[10px] text-slate-500">{product.category?.name || 'Produk'}</span>
              <strong className="mt-1 block min-h-9 text-xs leading-snug text-navy">{product.name}</strong>
              <span className="mt-2 block text-sm font-bold text-secondary">{money(product.sale_price)}</span>
              <span className="mt-2 block text-[10px] font-medium text-slate-500">Stok jual: {product.sale_stock}</span>
            </button>)}
          </div> : <p className="py-10 text-center text-sm text-slate-500">Produk tidak ditemukan atau belum tersedia untuk dijual.</p>}
        </section>

        <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-20">
          <div className="bg-navy px-5 py-4 text-white"><h2 className="m-0 text-base font-semibold">Transaksi baru</h2><p className="mb-0 mt-1 text-xs text-slate-300">Harga dan stok diverifikasi oleh server.</p></div>
          <div className="p-5">
            <CustomerPicker customers={customers} value={customerId} onChange={selectCustomer} />
            <div className="my-4 max-h-72 min-h-24 overflow-auto">
              {cart.map(({ product, quantity }) => <div key={product.id} className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
                <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-navy">{product.name}</strong><span className="mt-1 block text-[11px] text-slate-500">{money(product.sale_price)} / unit</span>
                  <div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => updateQuantity(product.id, -1)} aria-label={`Kurangi ${product.name}`} className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-600 hover:border-primary/50"><Minus size={13} /></button><span className="min-w-5 text-center text-xs font-semibold">{quantity}</span><button type="button" disabled={quantity >= Number(product.sale_stock)} onClick={() => updateQuantity(product.id, 1)} aria-label={`Tambah ${product.name}`} className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-600 hover:border-primary/50 disabled:opacity-40"><Plus size={13} /></button></div>
                </div>
                <button type="button" onClick={() => setCart((current) => current.filter((item) => item.product.id !== product.id))} aria-label={`Hapus ${product.name}`} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
              </div>)}
              {!cart.length && <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-xs text-slate-500">Keranjang masih kosong. Pilih produk untuk memulai.</div>}
            </div>
            <div className="border-t border-slate-200 pt-4"><div className="flex items-center justify-between text-sm text-slate-600"><span>Total yang harus dibayar</span><strong className="text-lg font-bold text-secondary">{money(total)}</strong></div>
              <label className="mt-4 block text-xs font-semibold text-secondary">Metode pembayaran
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-secondary">
                  <option value="cash">Tunai</option><option value="qris">QRIS statis</option>
                </select>
              </label>
              {paymentMethod === 'cash'
                ? <label className="mt-4 block text-xs font-semibold text-navy">Uang diterima<input required type="number" min={total} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label>
                : <div className="mt-4 rounded-lg border border-[#E8D6CE] bg-[#FBF6F3] p-3 text-xs text-secondary">
                  <label className="block font-semibold">Gambar barcode QRIS toko
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={saveQrisImage} className="mt-2 block w-full text-xs font-normal" />
                  </label>
                  {qrisImage && <img src={qrisImage} alt="Pratinjau barcode QRIS toko" className="mt-3 max-h-36 w-full rounded-md bg-white object-contain p-2" />}
                  {qrisImageError && <p role="alert" className="mb-0 mt-2 text-red-700">{qrisImageError}</p>}
                  <p className="mb-0 mt-2">Kasir menyampaikan nominal total kepada pelanggan, lalu memeriksa aplikasi merchant atau mutasi bank sebelum konfirmasi.</p>
                </div>}
              <button type="button" disabled={saving || !cart.length || !customerId || (paymentMethod === 'qris' && !qrisImage)} onClick={processSale} className={`mt-4 h-11 w-full rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${paymentMethod === 'qris' ? 'bg-secondary text-white hover:bg-secondary/85' : 'bg-primary text-secondary hover:bg-secondary hover:text-white'}`}>{saving ? 'Memproses penjualan...' : paymentMethod === 'qris' ? 'Buat transaksi QRIS · Pending' : 'Proses penjualan & catat tunai'}</button>
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="m-0 text-sm font-semibold text-navy">Riwayat transaksi penjualan</h2><p className="mb-0 mt-1 text-xs text-slate-500">{orders.length} transaksi · data API</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><tr>{['Nomor transaksi', 'Tanggal', 'Pelanggan', 'Item', 'Total', 'Status', 'Pembayaran'].map((column) => <th key={column} className="h-11 whitespace-nowrap px-4">{column}</th>)}</tr></thead>
            <tbody>{orders.map((order) => <tr key={order.id} className="border-t border-slate-100 text-xs text-slate-600">
              <td className="h-14 whitespace-nowrap px-4 font-semibold text-navy">{order.order_number}</td>
              <td className="whitespace-nowrap px-4">{dateLabel(order.created_at)}</td>
              <td className="px-4">{order.customer?.name || '—'}</td>
              <td className="px-4">{(order.order_items || []).map((item) => `${item.product?.name || 'Produk'} × ${item.quantity}`).join(', ') || '—'}</td>
              <td className="whitespace-nowrap px-4 font-semibold text-navy">{money(order.total_amount)}</td>
              <td className="px-4"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${order.status === 'confirmed' || order.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : order.status === 'cancelled' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800'}`}>{statusLabels[order.status] || order.status}</span></td>
              <td className="px-4"><div className="whitespace-nowrap font-semibold text-navy">{paymentStatusLabels[order.payment_status] || 'Belum dibayar'}</div><div className="mt-1 text-[10px] text-slate-500">{money(order.amount_paid || 0)} / {money(order.total_amount)}</div>{(order.payments || []).map((payment) => <div key={payment.id} className="mt-1 whitespace-nowrap text-[10px] text-slate-500">{payment.reference} · {paymentMethodLabels[payment.method] || payment.method} · {payment.method === 'qris' && payment.status === 'succeeded' ? 'Paid' : payment.status === 'pending' ? 'Pending' : payment.status}</div>)}{(order.payments || []).filter((payment) => payment.method === 'qris' && payment.status === 'pending').map((payment) => <div key={`verify-${payment.id}`} className="mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => setQrisPaymentDialog({ order, payment, qrImage: qrisImage })} className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-white">Verifikasi QRIS</button><button type="button" onClick={() => cancelPendingQrisOrder(order)} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600">Batalkan</button></div>)}{Number(order.balance_due ?? order.total_amount) > 0 && order.status !== 'cancelled' && !(order.payments || []).some((payment) => payment.status === 'pending') && <div className="mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => openPaymentDialog(order)} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-navy hover:bg-slate-50">Catat tunai</button><button type="button" disabled={!qrisImage} onClick={() => startQrisPayment(order).catch((error) => notify(errorMessage(error), 'error'))} className="rounded-md border border-secondary px-2 py-1 text-[10px] font-semibold text-secondary disabled:opacity-50">Buat QRIS</button></div>}</td>
            </tr>)}
            {!orders.length && <tr><td colSpan={7} className="h-20 text-center text-sm text-slate-500">Belum ada transaksi penjualan.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>}
    <p className="mb-0 mt-4 text-xs leading-relaxed text-slate-500">Status pembayaran dicatat terpisah dari konfirmasi transaksi dan perubahan stok.</p>
    {paymentDialog && <CashPaymentDialog
      title="Catat pembayaran tunai"
      transactionNumber={paymentDialog.order_number}
      amountDue={Number(paymentDialog.balance_due ?? paymentDialog.total_amount)}
      onClose={() => setPaymentDialog(null)}
      onSubmit={(received) => recordCashPayment(paymentDialog, received, paymentDialog.idempotencyKey, paymentDialog.keyName)}
    />}
    {qrisPaymentDialog && <StaticQrisDialog
      transactionNumber={qrisPaymentDialog.order.order_number}
      amount={qrisPaymentDialog.payment.amount}
      qrImage={qrisPaymentDialog.qrImage}
      payment={qrisPaymentDialog.payment}
      onClose={() => setQrisPaymentDialog(null)}
      onConfirm={() => confirmQrisPayment(qrisPaymentDialog.order, qrisPaymentDialog.payment)}
    />}
    </div>}
    {activeTab === 'rentals' && <div id="pos-panel-rentals" role="tabpanel" aria-labelledby="pos-tab-rentals">
      <AdminRentalsPage mode="cashier" />
    </div>}
  </div>
}
