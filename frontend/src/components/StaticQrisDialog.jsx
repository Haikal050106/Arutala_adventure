import { useState } from 'react'
import { money } from '../lib/customer-shop'

export default function StaticQrisDialog({ transactionNumber, amount, qrImage, payment, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const paid = payment.status === 'succeeded'

  const confirm = async () => {
    if (busy || paid) return
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Konfirmasi pembayaran QRIS gagal.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#24211F]/60 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="static-qris-title" className="my-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
      <h2 id="static-qris-title" className="m-0 text-lg font-bold text-[#24211F]">Pembayaran QRIS statis</h2>
      <p className="mb-1 mt-2 text-xs text-slate-600">{transactionNumber} · Sampaikan nominal ini kepada pelanggan:</p>
      <p className="m-0 text-center text-2xl font-extrabold text-[#8F4528]">{money(amount)}</p>
      <img src={qrImage} alt="Barcode QRIS toko" className="mx-auto my-4 max-h-64 w-full max-w-64 rounded-lg border border-slate-200 object-contain p-2" />
      <p className="m-0 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">Status pembayaran: <b>{paid ? 'Paid' : 'Pending — menunggu verifikasi kasir'}</b>. Periksa pembayaran pada aplikasi merchant atau mutasi bank sebelum menandai pembayaran sebagai lunas.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-50">Tutup</button>
        {!paid && <button type="button" disabled={busy} onClick={confirm} className="h-10 rounded-lg bg-[#8F4528] px-3 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Menyimpan...' : 'Sudah diverifikasi — tandai Paid'}</button>}
      </div>
    </section>
  </div>
}
