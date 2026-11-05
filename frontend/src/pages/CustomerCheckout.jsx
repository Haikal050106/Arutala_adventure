import { useState } from 'react'
import { ArrowLeft, LockKeyhole, ShieldAlert } from 'lucide-react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useCustomerStore } from '../components/useCustomerStore'
import { money } from '../lib/customer-shop'

export default function CustomerCheckout() {
  const { cart, profile, authLoading, authError, createPurchaseOrder } = useCustomerStore()
  const { notify } = useOutletContext()
  const navigate = useNavigate()
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const purchaseItems = cart.filter((item) => item.kind === 'purchase')
  const purchaseTotal = purchaseItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  const submit = async (event) => {
    event.preventDefault()
    if (!profile) {
      navigate('/masuk?next=/checkout')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const order = await createPurchaseOrder({ notes: notes.trim() })
      notify('Pesanan berhasil dikirim dan tersimpan di server.')
      navigate(`/pesanan/${encodeURIComponent(order.id)}`)
    } catch (error) {
      if (error?.status === 401) {
        notify('Sesi pelanggan berakhir. Masuk kembali untuk melanjutkan checkout.')
        navigate('/masuk?next=/checkout')
        return
      }
      setMessage(error instanceof Error ? error.message : 'Pesanan gagal dikirim. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading) return <div className="mx-auto max-w-xl px-5 py-20 text-center" role="status"><p className="text-sm text-[#566274]">Memeriksa sesi akun...</p></div>

  if (!purchaseItems.length) return <div className="mx-auto max-w-2xl px-5 py-16 text-center">
    <h1 className="text-2xl font-bold text-navy">Belum ada produk untuk dibeli</h1>
    <p className="mt-2 text-sm text-[#566274]">Checkout ini hanya memproses pembelian barang. Item sewa tetap aman di keranjang dan dapat dikirim secara terpisah sebagai booking sewa.</p>
    <Link to="/keranjang" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white"><ArrowLeft size={16} />Kembali ke keranjang</Link>
  </div>

  return <div className="mx-auto max-w-6xl px-5 py-10 max-md:px-4 max-md:py-7">
    <Link to="/keranjang" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#566274] hover:text-navy"><ArrowLeft size={16} />Kembali ke keranjang</Link>
    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Tinjau dan kirim</p>
    <h1 className="mb-7 text-3xl font-bold tracking-tight text-navy max-sm:text-2xl">Checkout pembelian</h1>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={submit} className="rounded-xl border border-[#DDE2E9] bg-white p-5 shadow-[0_2px_12px_rgba(23,43,77,0.04)] max-sm:p-4">
        <h2 className="mb-4 text-base font-semibold text-navy">Informasi pelanggan</h2>
        {!profile ? <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs leading-relaxed text-[#7D3B0E]"><div className="flex gap-2"><ShieldAlert size={16} className="mt-0.5 shrink-0" /><span>Masuk atau daftar agar pesanan terhubung ke akun pelanggan Anda.{authError && <span className="mt-1 block">{authError}</span>}</span></div><Link to="/masuk?next=/checkout" className="mt-2 inline-flex font-semibold underline">Masuk / daftar</Link></div> : <div className="mb-4 rounded-lg bg-canvas p-3 text-xs text-[#566274]"><b className="block text-navy">{profile.name}</b><span>{profile.email} · {profile.phone}</span></div>}
        <label className="block text-xs font-semibold text-navy">Catatan untuk toko <span className="font-normal text-[#566274]">(opsional)</span><textarea rows="4" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 block w-full resize-y rounded-lg border border-[#DDE2E9] p-3 text-sm font-normal outline-none focus:border-primary" placeholder="Catatan terkait pembelian" /></label>
        {cart.some((item) => item.kind === 'rental') && <p className="mb-0 mt-4 rounded-lg bg-orange-50 p-3 text-xs leading-relaxed text-[#7D3B0E]">Barang pembelian akan dikirim sebagai pesanan. Item sewa tidak ikut checkout dan tetap tersimpan di keranjang.</p>}
        {message && <p role="alert" className="mt-4 rounded-lg bg-orange-50 p-3 text-xs text-[#9A3C08]">{message}</p>}
        <button type="submit" disabled={busy || !profile} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition hover:bg-[#E7650D] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Mengirim pesanan...' : profile ? 'Buat pesanan' : 'Masuk untuk melanjutkan'}<LockKeyhole size={15} /></button>
        <p className="mb-0 mt-3 text-center text-[11px] leading-relaxed text-[#566274]">Checkout hanya membuat pesanan. Pembayaran dilakukan langsung di toko Arutala Adventure dan dikonfirmasi kasir setelah uang diterima.</p>
      </form>
      <aside className="rounded-xl border border-[#DDE2E9] bg-white p-5 shadow-[0_4px_18px_rgba(23,43,77,0.06)]">
        <h2 className="mb-4 text-base font-semibold text-navy">Ringkasan pembelian</h2>
        <div className="space-y-3">{purchaseItems.map((item) => <div key={item.id} className="flex justify-between gap-3 text-xs">
          <span className="text-[#566274]">{item.name} × {item.quantity}</span>
          <b className="shrink-0 text-navy">{money(item.unitPrice * item.quantity)}</b>
        </div>)}</div>
        <div className="mt-4 flex justify-between border-t border-[#DDE2E9] pt-4"><span className="text-sm font-semibold text-navy">Estimasi subtotal</span><strong className="text-lg text-navy">{money(purchaseTotal)}</strong></div>
        <p className="mb-0 mt-3 text-xs leading-relaxed text-[#566274]">Harga dan total final dihitung kembali di server. Setelah checkout, status pesanan Menunggu Pembayaran. Bayar langsung di toko Arutala Adventure; kasir mencatat pembayaran setelah uang diterima.</p>
      </aside>
    </div>
  </div>
}
