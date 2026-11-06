import { useCallback, useEffect, useState } from 'react'
import { CreditCard, RefreshCw } from 'lucide-react'
import CashPaymentDialog from './CashPaymentDialog'
import StaticQrisDialog from './StaticQrisDialog'
import { adminApiRequest, readAdminToken } from '../lib/admin-api'
import { money } from '../lib/customer-shop'

const errorMessage = (error) => error instanceof Error ? error.message : 'Permintaan ke server gagal.'

function paymentRequestKey(rentalId) {
  const keyName = `arutala-payment-request-rental-${rentalId}`
  let idempotencyKey = sessionStorage.getItem(keyName)
  if (!idempotencyKey) {
    idempotencyKey = crypto.randomUUID()
    sessionStorage.setItem(keyName, idempotencyKey)
  }
  return { keyName, idempotencyKey }
}

export default function RentalPaymentPanel({ notify, qrisImage }) {
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [cashDialog, setCashDialog] = useState(null)
  const [qrisDialog, setQrisDialog] = useState(null)

  const loadRentals = useCallback(async () => {
    setLoadError('')
    try {
      const records = await adminApiRequest('/rentals', { token: readAdminToken() })
      if (!Array.isArray(records)) throw new Error('Daftar penyewaan dari server tidak valid.')
      setRentals(records)
      return true
    } catch (error) {
      setLoadError(errorMessage(error))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRentals()
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void loadRentals()
    }
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [loadRentals])

  const recordCashPayment = async (rental, received, keyName, idempotencyKey) => {
    setSavingId(rental.id)
    try {
      const payment = await adminApiRequest(`/rentals/${rental.id}/payments`, {
        method: 'POST',
        token: readAdminToken(),
        idempotencyKey,
        body: {
          payment: {
            amount: rental.balance_due,
            cash_received: received,
            method: 'cash',
          },
        },
      })
      sessionStorage.removeItem(keyName)
      const refreshed = await loadRentals()
      notify(
        refreshed
          ? `Pembayaran tunai ${payment.reference} berhasil dicatat.`
          : `Pembayaran tunai ${payment.reference} berhasil dicatat, tetapi daftar penyewaan gagal dimuat ulang.`,
        refreshed ? 'success' : 'error',
      )
      return true
    } finally {
      setSavingId(null)
    }
  }

  const openQris = async (rental) => {
    const existing = (rental.payments || []).find((payment) => payment.method === 'qris' && payment.status === 'pending')
    if (existing) {
      setQrisDialog({ rental, payment: existing })
      return
    }

    const { keyName, idempotencyKey } = paymentRequestKey(rental.id)
    setSavingId(rental.id)
    try {
      const payment = await adminApiRequest(`/rentals/${rental.id}/payments`, {
        method: 'POST',
        token: readAdminToken(),
        idempotencyKey,
        body: { payment: { amount: rental.balance_due, method: 'qris' } },
      })
      sessionStorage.removeItem(keyName)
      setQrisDialog({ rental, payment })
      const refreshed = await loadRentals()
      if (!refreshed) notify('QRIS berhasil dibuat, tetapi daftar penyewaan gagal dimuat ulang.', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const confirmQris = async (rental, payment) => {
    setSavingId(rental.id)
    try {
      await adminApiRequest(`/rentals/${rental.id}/payments/${payment.id}/confirm`, {
        method: 'POST',
        token: readAdminToken(),
      })
      setQrisDialog(null)
      const refreshed = await loadRentals()
      notify(
        refreshed
          ? `Pembayaran QRIS ${payment.reference} telah diverifikasi dan dicatat Paid.`
          : `Pembayaran QRIS ${payment.reference} telah dicatat Paid, tetapi daftar penyewaan gagal dimuat ulang.`,
        refreshed ? 'success' : 'error',
      )
    } finally {
      setSavingId(null)
    }
  }

  const payableRentals = rentals.filter((rental) =>
    rental.status === 'confirmed' && Number(rental.balance_due) > 0)

  return <section className="mt-6 overflow-hidden rounded-xl border border-[#E8D6CE] bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0E8E4] px-5 py-4">
      <div>
        <h2 className="m-0 flex items-center gap-2 text-sm font-semibold text-secondary"><CreditCard size={16} className="text-secondary" />Pembayaran penyewaan</h2>
        <p className="mb-0 mt-1 text-xs text-slate-500">Pembayaran hanya tersedia setelah Admin/Kasir menyetujui booking.</p>
      </div>
      <button type="button" onClick={() => { setLoading(true); void loadRentals() }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw size={13} />Muat ulang</button>
    </div>
    {loadError && <p role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">Daftar penyewaan gagal dimuat: {loadError}</p>}
    {loading ? <p role="status" className="p-6 text-center text-sm text-slate-500">Memuat penyewaan dari server...</p> : <div className="divide-y divide-slate-100">
      {payableRentals.map((rental) => {
        const pendingQris = (rental.payments || []).some((payment) => payment.method === 'qris' && payment.status === 'pending')
        return <article key={rental.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-[220px] flex-1">
            <p className="m-0 text-xs font-semibold text-secondary">{rental.rental_number} · {rental.customer?.name || 'Pelanggan'}</p>
            <p className="mb-0 mt-1 text-xs text-slate-500">{rental.display_status || 'Menunggu Pembayaran'} · pembayaran {rental.payment_status === 'partially_paid' ? 'sebagian' : 'belum lunas'}</p>
            <div className="mt-3 grid max-w-lg grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
              <div><span className="block text-slate-500">Total sewa</span><strong className="mt-1 block text-navy">{money(rental.total_amount)}</strong></div>
              <div><span className="block text-slate-500">Sudah dibayar</span><strong className="mt-1 block text-navy">{money(rental.amount_paid || 0)}</strong></div>
              <div><span className="block text-slate-500">Sisa tagihan</span><strong className="mt-1 block text-secondary">{money(rental.balance_due)}</strong></div>
            </div>
            {(rental.rental_items || []).map((item) => <div key={item.id} className="mt-2 text-[11px] text-slate-500">
              <p className="m-0 font-semibold text-slate-600">{item.product?.name || 'Perlengkapan'} × {item.quantity}</p>
              <p className="mb-0 mt-0.5">{item.start_date}–{item.return_date} · {item.rental_days} hari · {money(item.unit_price_per_day)}/unit/hari · Subtotal {money(item.subtotal)}</p>
            </div>)}
            {pendingQris && <p className="mb-0 mt-1 text-[11px] font-semibold text-secondary">QRIS Pending · periksa dana masuk pada aplikasi merchant/mutasi bank.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingQris
              ? <button type="button" disabled={!qrisImage || savingId === rental.id} onClick={() => openQris(rental)} className="h-9 rounded-lg bg-secondary px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Verifikasi QRIS</button>
              : <>
                <button type="button" disabled={savingId === rental.id} onClick={() => setCashDialog({ rental, ...paymentRequestKey(rental.id) })} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-secondary disabled:opacity-50">Bayar tunai</button>
                <button type="button" disabled={!qrisImage || savingId === rental.id} onClick={() => openQris(rental).catch((error) => notify(errorMessage(error), 'error'))} className="h-9 rounded-lg bg-secondary px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Bayar QRIS statis</button>
              </>}
          </div>
        </article>
      })}
      {!payableRentals.length && <p className="p-6 text-center text-sm text-slate-500">Tidak ada penyewaan disetujui yang menunggu pembayaran.</p>}
    </div>}
    {!qrisImage && <p className="m-4 mt-0 rounded-lg bg-[#FBF6F3] p-3 text-xs text-[#71371F]">Unggah barcode QRIS toko pada bagian pembayaran penjualan POS untuk mengaktifkan pembayaran QRIS penyewaan di perangkat ini.</p>}
    {cashDialog && <CashPaymentDialog
      title="Catat pembayaran sewa"
      transactionNumber={cashDialog.rental.rental_number}
      amountDue={Number(cashDialog.rental.balance_due)}
      onClose={() => setCashDialog(null)}
      onSubmit={(received) => recordCashPayment(cashDialog.rental, received, cashDialog.keyName, cashDialog.idempotencyKey)}
    />}
    {qrisDialog && <StaticQrisDialog
      transactionNumber={qrisDialog.rental.rental_number}
      amount={qrisDialog.payment.amount}
      qrImage={qrisImage}
      payment={qrisDialog.payment}
      onClose={() => setQrisDialog(null)}
      onConfirm={() => confirmQris(qrisDialog.rental, qrisDialog.payment)}
    />}
  </section>
}
