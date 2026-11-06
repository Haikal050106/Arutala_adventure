import { Printer, X } from 'lucide-react'
import { money } from '../lib/customer-shop'
import { printPaymentReceipt } from '../lib/payment-receipt'

const methodLabels = { cash: 'Tunai', qris: 'QRIS statis', gateway: 'Payment gateway' }
const statusLabels = { pending: 'Menunggu pembayaran', succeeded: 'Berhasil', failed: 'Gagal', refunded: 'Dikembalikan' }

function paymentDate(payment) {
  const value = payment.paidAt || payment.paid_at || payment.createdAt || payment.created_at
  return value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Belum tercatat'
}

export default function PaymentReceipt({ payment, transaction, onClose }) {
  const method = methodLabels[payment.method] || payment.method || '—'
  const status = payment.method === 'qris' && payment.status === 'pending'
    ? 'Pending — menunggu verifikasi kasir'
    : payment.method === 'qris' && payment.status === 'succeeded'
      ? 'Paid'
      : statusLabels[payment.status] || payment.status || '—'
  const items = transaction.items || []

  const handlePrint = () => {
    try {
      printPaymentReceipt(payment, transaction)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Struk gagal dicetak.')
    }
  }

  return <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/50 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="payment-receipt-title" className="my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div><p className="m-0 text-[10px] font-bold uppercase tracking-wider text-primary">Arutala Adventure · Struk digital</p><h2 id="payment-receipt-title" className="mb-0 mt-1 text-lg font-bold text-navy">{transaction.number}</h2></div>
        <button type="button" onClick={onClose} aria-label="Tutup struk" className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X size={17} /></button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-200 py-3 text-xs">
        <dt className="text-slate-500">Jenis transaksi</dt><dd className="m-0 text-right font-semibold text-navy">{transaction.type}</dd>
        <dt className="text-slate-500">Pelanggan</dt><dd className="m-0 text-right font-semibold text-navy">{transaction.customer?.name || '—'}</dd>
        <dt className="text-slate-500">Tanggal transaksi</dt><dd className="m-0 text-right text-navy">{transaction.createdAt ? new Date(transaction.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</dd>
      </dl>
      <h3 className="mb-2 mt-4 text-xs font-bold text-navy">Rincian barang</h3>
      <div className="space-y-2 border-b border-slate-200 pb-3">
        {items.map((item, index) => <div key={item.id || `${item.name}-${index}`} className="flex justify-between gap-3 text-xs">
          <span className="text-slate-600">{item.name} × {item.quantity}{item.detail ? <small className="block mt-1 text-slate-400">{item.detail}</small> : null}</span>
          <strong className="whitespace-nowrap text-navy">{money(item.subtotal)}</strong>
        </div>)}
      </div>
      <div className="space-y-2 border-b border-slate-200 py-3 text-xs">
        <div className="flex justify-between text-slate-600"><span>Total transaksi</span><strong className="text-navy">{money(transaction.totalAmount)}</strong></div>
        <div className="flex justify-between text-slate-600"><span>Nominal pembayaran</span><strong className="text-navy">{money(payment.amount)}</strong></div>
        <div className="flex justify-between text-slate-600"><span>Metode</span><span className="font-semibold text-navy">{method}</span></div>
        <div className="flex justify-between text-slate-600"><span>Status pembayaran</span><span className="font-semibold text-navy">{status}</span></div>
        <div className="flex justify-between text-slate-600"><span>Waktu pembayaran</span><span className="text-right text-navy">{paymentDate(payment)}</span></div>
        {(payment.confirmed_by_id != null || payment.created_by_id != null) && <div className="flex justify-between text-slate-600"><span>Kasir</span><span className="text-right text-navy">#{payment.confirmed_by_id ?? payment.created_by_id}</span></div>}
        {(payment.cash_received != null || payment.cashReceived != null) && <div className="flex justify-between text-slate-600"><span>Uang diterima / kembalian</span><span className="text-right text-navy">{money(payment.cash_received ?? payment.cashReceived)} / {money(payment.change_amount ?? payment.changeAmount)}</span></div>}
        <div className="flex justify-between gap-3 text-slate-600"><span>Referensi</span><span className="break-all text-right font-semibold text-navy">{payment.reference || '—'}</span></div>
      </div>
      <p className="mb-0 mt-3 text-[10px] text-slate-500">Bukti ini menampilkan status Payment dari ledger, bukan status Order atau Rental.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">Tutup</button>
        <button type="button" onClick={handlePrint} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-secondary"><Printer size={14} />Cetak struk</button>
      </div>
    </section>
  </div>
}
