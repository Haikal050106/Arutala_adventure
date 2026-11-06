import { useEffect, useMemo, useState } from 'react'
import PaymentReceipt from '../../components/PaymentReceipt'
import { adminApiRequest, readAdminToken } from '../../lib/admin-api'
import { money } from '../../lib/customer-shop'

const paymentStatusLabels = {
  pending: 'Menunggu pembayaran',
  succeeded: 'Berhasil',
  failed: 'Gagal',
  refunded: 'Dikembalikan',
}
const methodLabels = { cash: 'Tunai', qris: 'QRIS statis', gateway: 'Payment gateway' }
const dateTime = (date) => date ? new Date(date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const errorMessage = (error) => error instanceof Error ? error.message : 'Riwayat pembayaran gagal dimuat.'

function transactionReceipt(transaction, type, payment) {
  const isRental = type === 'Penyewaan'
  const sourceItems = isRental ? transaction.rental_items : transaction.order_items
  const items = (sourceItems || []).map((item) => {
    const quantity = Number(item.quantity)
    const unitPrice = Number(isRental ? item.unit_price_per_day : item.unit_price)
    const subtotal = Number(item.subtotal)
    const detail = isRental
      ? `${item.start_date}–${item.return_date} · ${item.rental_days} hari · ${money(unitPrice)} / unit / hari`
      : `${money(unitPrice)} / unit`
    return { id: item.id, name: item.product?.name || 'Produk', quantity, unitPrice, subtotal, detail }
  })
  return {
    payment,
    transaction: {
      type,
      number: isRental ? transaction.rental_number : transaction.order_number,
      createdAt: transaction.created_at,
      totalAmount: Number(transaction.total_amount),
      customer: transaction.customer,
      items,
    },
  }
}

export default function AdminPaymentHistoryPage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const token = readAdminToken()
        const [orders, rentals] = await Promise.all([
          adminApiRequest('/orders', { token }),
          adminApiRequest('/rentals', { token }),
        ])
        const payments = [
          ...orders.flatMap((order) => (order.payments || []).map((payment) => ({
            ...transactionReceipt(order, 'Pembelian', payment),
            transactionType: 'Pembelian',
          }))),
          ...rentals.flatMap((rental) => (rental.payments || []).map((payment) => ({
            ...transactionReceipt(rental, 'Penyewaan', payment),
            transactionType: 'Penyewaan',
          }))),
        ].sort((first, second) => new Date(second.payment.paid_at || second.payment.created_at) - new Date(first.payment.paid_at || first.payment.created_at))
        if (active) setRecords(payments)
      } catch (requestError) {
        if (active) setError(errorMessage(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const visibleRecords = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return records
    return records.filter(({ payment, transaction, transactionType }) => (
      `${payment.reference} ${transaction.number} ${transaction.customer?.name || ''} ${transaction.customer?.phone || ''} ${transactionType} ${payment.method} ${payment.status}`
        .toLowerCase().includes(search)
    ))
  }, [query, records])

  return <section>
    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Pembayaran · Ledger</p>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="m-0 text-2xl font-bold tracking-tight text-navy">Riwayat Pembayaran</h1><p className="mb-0 mt-2 text-sm text-slate-600">Catatan Payment Order dan Rental; status berasal dari ledger pembayaran.</p></div>
      <label className="w-full max-w-sm text-xs font-semibold text-navy">Cari transaksi atau pelanggan
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nomor transaksi, referensi, nama, HP" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
      </label>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="py-10 text-center text-sm text-slate-500">Memuat riwayat pembayaran...</p>
      : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><tr>{['Waktu', 'Referensi Payment', 'Transaksi', 'Pelanggan', 'Metode', 'Nominal', 'Status Payment', 'Struk'].map((heading) => <th key={heading} className="h-11 whitespace-nowrap px-4">{heading}</th>)}</tr></thead>
          <tbody>{visibleRecords.map(({ payment, transaction, transactionType }) => <tr key={`${transactionType}-${transaction.number}-${payment.id}`} className="border-t border-slate-100 text-xs text-slate-600">
            <td className="whitespace-nowrap px-4 py-3">{dateTime(payment.paid_at || payment.created_at)}</td>
            <td className="px-4 font-semibold text-navy">{payment.reference}</td>
            <td className="px-4"><span className="block font-semibold text-navy">{transaction.number}</span><span className="text-[10px] text-slate-500">{transactionType}</span></td>
            <td className="px-4">{transaction.customer?.name || '—'}</td>
            <td className="px-4">{methodLabels[payment.method] || payment.method}</td>
            <td className="whitespace-nowrap px-4 font-semibold text-navy">{money(payment.amount)}</td>
            <td className="px-4">{payment.method === 'qris' && payment.status === 'pending' ? 'Pending — verifikasi kasir' : payment.method === 'qris' && payment.status === 'succeeded' ? 'Paid' : paymentStatusLabels[payment.status] || payment.status}</td>
            <td className="px-4"><button type="button" onClick={() => setSelectedReceipt({ payment, transaction })} className="whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1.5 font-semibold text-navy hover:bg-slate-50">Lihat / cetak</button></td>
          </tr>)}
          {!visibleRecords.length && <tr><td colSpan={8} className="h-20 text-center text-sm text-slate-500">{records.length ? 'Tidak ada pembayaran yang cocok.' : 'Belum ada pembayaran di ledger.'}</td></tr>}
          </tbody>
        </table>
      </div>}
    <p className="mb-0 mt-3 text-xs text-slate-500">{records.length} catatan Payment dari data Order dan Rental.</p>
    {selectedReceipt && <PaymentReceipt {...selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
  </section>
}
