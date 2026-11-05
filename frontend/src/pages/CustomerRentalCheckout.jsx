import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, LockKeyhole, ShieldAlert } from 'lucide-react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useCustomerStore } from '../components/useCustomerStore'
import { money, rentalDays } from '../lib/customer-shop'

export default function CustomerRentalCheckout() {
  const { cart, profile, authLoading, authError, createRentalBooking } = useCustomerStore()
  const { notify } = useOutletContext()
  const navigate = useNavigate()
  const rentalItems = cart.filter((item) => item.kind === 'rental')
  const [villageName, setVillageName] = useState(profile?.villageName || '')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const total = rentalItems.reduce((sum, item) => sum + item.unitPrice * item.quantity * rentalDays(item.startDate, item.returnDate), 0)

  useEffect(() => {
    if (!villageName && profile?.villageName) setVillageName(profile.villageName)
  }, [profile, villageName])

  const submit = async (event) => {
    event.preventDefault()
    if (!profile) {
      navigate('/masuk?next=/checkout-sewa')
      return
    }
    if (!rentalItems.length) {
      setMessage('Keranjang tidak memiliki perlengkapan untuk disewa.')
      return
    }
    if (rentalItems.some((item) => !rentalDays(item.startDate, item.returnDate))) {
      setMessage('Lengkapi tanggal mulai dan tanggal kembali pada keranjang.')
      return
    }
    if (!villageName.trim()) {
      setMessage('Alamat Desa/Kelurahan wajib diisi untuk booking sewa.')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const booking = await createRentalBooking({ villageName, notes })
      notify('Booking sewa berhasil dikirim. Pembayaran dilakukan langsung di toko Arutala Adventure.')
      navigate(`/akun?booking=${encodeURIComponent(booking.id)}`)
    } catch (error) {
      if (error?.status === 401) {
        notify('Sesi pelanggan berakhir. Masuk kembali untuk melanjutkan booking.')
        navigate('/masuk?next=/checkout-sewa')
        return
      }
      setMessage(error instanceof Error ? error.message : 'Booking sewa gagal dikirim. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading) return <div className="mx-auto max-w-xl px-5 py-20 text-center" role="status"><p className="text-sm text-[#566274]">Memeriksa sesi akun...</p></div>

  if (!rentalItems.length) return <div className="mx-auto max-w-2xl px-5 py-16 text-center">
    <h1 className="text-2xl font-bold text-navy">Belum ada perlengkapan untuk disewa</h1>
    <p className="mt-2 text-sm text-[#566274]">Checkout booking sewa hanya memproses item sewa. Item pembelian tetap terpisah di keranjang.</p>
    <Link to="/keranjang" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white"><ArrowLeft size={16} />Kembali ke keranjang</Link>
  </div>

  return <div className="mx-auto max-w-6xl px-5 py-10 max-md:px-4 max-md:py-7">
    <Link to="/keranjang" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#566274] hover:text-navy"><ArrowLeft size={16} />Kembali ke keranjang</Link>
    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Booking pelanggan</p>
    <h1 className="mb-7 text-3xl font-bold tracking-tight text-navy max-sm:text-2xl">Checkout booking sewa</h1>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={submit} className="rounded-xl border border-[#DDE2E9] bg-white p-5 shadow-[0_2px_12px_rgba(23,43,77,0.04)] max-sm:p-4">
        <h2 className="mb-4 text-base font-semibold text-navy">Informasi penyewa</h2>
        {!profile ? <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs leading-relaxed text-[#7D3B0E]"><div className="flex gap-2"><ShieldAlert size={16} className="mt-0.5 shrink-0" /><span>Masuk atau daftar agar booking terhubung ke akun pelanggan Anda.{authError && <span className="mt-1 block">{authError}</span>}</span></div><Link to="/masuk?next=/checkout-sewa" className="mt-2 inline-flex font-semibold underline">Masuk / daftar</Link></div> : <div className="mb-4 rounded-lg bg-canvas p-3 text-xs text-[#566274]"><b className="block text-navy">{profile.name}</b><span>{profile.email} · {profile.phone}</span></div>}
        <label className="block text-xs font-semibold text-navy">Alamat Desa/Kelurahan<input required maxLength={150} value={villageName} onChange={(event) => setVillageName(event.target.value)} className="mt-1.5 block h-11 w-full rounded-lg border border-[#DDE2E9] px-3 text-sm font-normal outline-none focus:border-primary" placeholder="Masukkan Desa/Kelurahan" /></label>
        <label className="mt-4 block text-xs font-semibold text-navy">Catatan untuk toko <span className="font-normal text-[#566274]">(opsional)</span><textarea rows="4" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 block w-full resize-y rounded-lg border border-[#DDE2E9] p-3 text-sm font-normal outline-none focus:border-primary" placeholder="Catatan terkait booking sewa" /></label>
        {message && <p role="alert" className="mt-4 rounded-lg bg-orange-50 p-3 text-xs text-[#9A3C08]">{message}</p>}
        <button type="submit" disabled={busy || !profile} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition hover:bg-[#E7650D] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Mengirim booking...' : profile ? 'Kirim booking sewa' : 'Masuk untuk melanjutkan'}<LockKeyhole size={15} /></button>
        <p className="mb-0 mt-3 text-center text-[11px] leading-relaxed text-[#566274]">Tanggal, tarif, dan ketersediaan divalidasi server. Booking menunggu pembayaran di toko Arutala Adventure; kasir mengonfirmasi pembayaran setelah uang diterima.</p>
      </form>
      <aside className="rounded-xl border border-[#DDE2E9] bg-white p-5 shadow-[0_4px_18px_rgba(23,43,77,0.06)]">
        <h2 className="mb-4 text-base font-semibold text-navy">Ringkasan booking</h2>
        <div className="space-y-4">{rentalItems.map((item) => {
          const days = rentalDays(item.startDate, item.returnDate)
          return <div key={item.id} className="border-b border-[#DDE2E9] pb-3 last:border-0">
            <p className="mb-1 text-xs font-semibold text-navy">{item.name} × {item.quantity}</p>
            <p className="mb-1 flex items-center gap-1 text-[11px] text-[#566274]"><CalendarDays size={13} />{item.startDate || 'Tanggal mulai'} – {item.returnDate || 'Tanggal kembali'}</p>
            <p className="mb-0 text-[11px] text-[#566274]">{days} hari × {money(item.unitPrice)} / unit / hari</p>
            <b className="mt-1 block text-xs text-navy">{money(item.unitPrice * item.quantity * days)}</b>
          </div>
        })}</div>
        <div className="mt-4 flex justify-between border-t border-[#DDE2E9] pt-4"><span className="text-sm font-semibold text-navy">Estimasi total</span><strong className="text-lg text-navy">{money(total)}</strong></div>
        <p className="mb-0 mt-3 text-xs leading-relaxed text-[#566274]">Total akhir dihitung kembali menggunakan tarif dan data ketersediaan terbaru di server.</p>
      </aside>
    </div>
  </div>
}
