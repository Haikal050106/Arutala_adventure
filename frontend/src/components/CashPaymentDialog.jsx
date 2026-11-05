import { useState } from 'react'
import { money } from '../lib/customer-shop'

export default function CashPaymentDialog({ title, transactionNumber, amountDue, onClose, onSubmit }) {
  const [cashReceived, setCashReceived] = useState(String(amountDue))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const change = Math.max(0, Number(cashReceived || 0) - Number(amountDue))

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const saved = await onSubmit(cashReceived)
      if (saved) onClose()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Pembayaran gagal dicatat.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="presentation">
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cash-payment-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
      <h2 id="cash-payment-title" className="m-0 text-lg font-semibold text-navy">{title}</h2>
      <p className="mb-4 mt-2 text-xs text-slate-600">{transactionNumber} · Sisa tagihan {money(amountDue)}</p>
      <label className="block text-xs font-semibold text-navy">Uang diterima
        <input required autoFocus type="number" min={amountDue} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
      </label>
      <div className="mt-3 flex justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600"><span>Kembalian</span><b className="text-sm text-navy">{money(change)}</b></div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-50">Batal</button>
        <button type="submit" disabled={busy || Number(cashReceived) < Number(amountDue)} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Mencatat...' : 'Catat tunai'}</button>
      </div>
    </form>
  </div>
}
