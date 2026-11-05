import { ArrowRight, CalendarDays, ShoppingBag, Trash2 } from 'lucide-react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useCustomerStore } from '../components/useCustomerStore'
import { money, rentalDays } from '../lib/customer-shop'
import CustomerImage from '../components/CustomerImage'

const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default function CustomerCart() {
  const { cart, products, updateQuantity, updateRentalDates, removeFromCart } = useCustomerStore()
  const { notify } = useOutletContext()
  const navigate = useNavigate()
  const purchaseCount = cart.filter((item) => item.kind === 'purchase').length
  const rentalCount = cart.filter((item) => item.kind === 'rental').length
  const purchaseTotal = cart.filter((item) => item.kind === 'purchase')
    .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const rentalTotal = cart.filter((item) => item.kind === 'rental')
    .reduce((sum, item) => sum + item.unitPrice * item.quantity * rentalDays(item.startDate, item.returnDate), 0)

  const handleQuantity = (item, quantity) => {
    const result = updateQuantity(item.id, quantity)
    if (!result.ok) notify(result.message)
  }

  const handleDate = (item, field, value) => {
    const nextStart = field === 'startDate' ? value : item.startDate
    const nextReturn = field === 'returnDate' ? value : item.returnDate
    const result = updateRentalDates(item.id, nextStart, nextReturn)
    if (!result.ok) notify(result.message)
  }

  const checkout = () => navigate('/checkout')

  return <div className="mx-auto max-w-6xl px-5 py-10 max-md:px-4 max-md:py-7"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Pesanan kamu</p><h1 className="mb-7 text-3xl font-bold tracking-tight text-navy max-sm:text-2xl">Keranjang</h1>
    {!cart.length ? <div className="rounded-2xl border border-dashed border-[#DDE2E9] bg-white px-6 py-16 text-center"><ShoppingBag size={32} className="mx-auto mb-4 text-slate-300" /><h2 className="m-0 text-lg font-semibold text-navy">Keranjang masih kosong</h2><p className="mb-5 mt-2 text-sm text-[#566274]">Pilih perlengkapan untuk pembelian atau booking sewa.</p><Link to="/katalog" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-[#E7650D]">Jelajahi katalog <ArrowRight size={16} /></Link></div> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-3">{cart.map((item) => { const days = item.kind === 'rental' ? rentalDays(item.startDate, item.returnDate) : 1; const subtotal = item.unitPrice * item.quantity * days; const product = products.find((entry) => entry.id === item.productId); return <article key={item.id} className="rounded-xl border border-[#DDE2E9] bg-white p-4 shadow-[0_2px_12px_rgba(23,43,77,0.04)]"><div className="flex gap-4 max-sm:gap-3"><CustomerImage src={product?.image} alt={product?.imageAlt || item.name} className="size-24 shrink-0 rounded-lg max-sm:size-20" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.kind === 'rental' ? 'bg-navy text-white' : 'bg-orange-50 text-[#C94F08]'}`}>{item.kind === 'rental' ? 'Sewa' : 'Beli'}</span><h2 className="mb-1 mt-2 text-sm font-semibold text-navy">{item.name}</h2><p className="m-0 text-xs text-[#566274]">{money(item.unitPrice)}{item.kind === 'rental' ? ' / unit / hari' : ' / unit'}</p></div><button type="button" onClick={() => removeFromCart(item.id)} className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label={`Hapus ${item.name}`}><Trash2 size={16} /></button></div>
          {item.kind === 'rental' && <div className="mt-3 grid max-w-md grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-[#566274]">Mulai<input type="date" min={localDate(new Date())} value={item.startDate} onChange={(event) => handleDate(item, 'startDate', event.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-[#DDE2E9] px-2 text-xs font-normal text-navy" /></label><label className="text-[10px] font-semibold text-[#566274]">Kembali<input type="date" min={item.startDate || localDate(new Date())} value={item.returnDate} onChange={(event) => handleDate(item, 'returnDate', event.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-[#DDE2E9] px-2 text-xs font-normal text-navy" /></label></div>}
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div className="flex items-center gap-2"><button type="button" aria-label="Kurangi jumlah" onClick={() => handleQuantity(item, item.quantity - 1)} className="grid size-8 place-items-center rounded-lg border border-[#DDE2E9]">−</button><span className="min-w-6 text-center text-sm font-semibold text-navy">{item.quantity}</span><button type="button" aria-label="Tambah jumlah" onClick={() => handleQuantity(item, item.quantity + 1)} className="grid size-8 place-items-center rounded-lg border border-[#DDE2E9]">+</button></div><p className="m-0 text-sm font-bold text-navy">{money(subtotal)}{item.kind === 'rental' && <small className="ml-1 font-normal text-[#566274]">· {days} hari</small>}</p></div>
        </div></div></article>})}</section>
      <aside className="rounded-xl border border-[#DDE2E9] bg-white p-5 shadow-[0_4px_18px_rgba(23,43,77,0.06)] lg:sticky lg:top-24"><h2 className="m-0 text-base font-semibold text-navy">Ringkasan</h2><div className="my-4 space-y-2 border-y border-[#DDE2E9] py-4 text-xs text-[#566274]"><div className="flex justify-between"><span>{cart.length} jenis perlengkapan</span><span>{cart.reduce((sum, item) => sum + item.quantity, 0)} unit</span></div>{purchaseCount > 0 && <div className="flex justify-between"><span>Subtotal pembelian</span><b className="text-navy">{money(purchaseTotal)}</b></div>}{rentalCount > 0 && <div className="flex justify-between"><span>Estimasi booking sewa</span><b className="text-navy">{money(rentalTotal)}</b></div>}</div><p className="mb-0 mt-2 text-[11px] leading-relaxed text-[#566274]">Pembelian dan penyewaan dikirim melalui checkout terpisah. Harga, tanggal, dan ketersediaan booking sewa divalidasi kembali oleh server; pembayaran online belum tersedia.</p>{purchaseCount > 0 && <button type="button" onClick={checkout} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition hover:bg-[#E7650D]">Checkout pembelian<ArrowRight size={16} /></button>}{rentalCount > 0 && <button type="button" onClick={() => navigate('/checkout-sewa')} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-navy text-sm font-semibold text-navy transition hover:bg-navy hover:text-white"><CalendarDays size={16} />Checkout booking sewa<ArrowRight size={16} /></button>}<Link to="/katalog" className="mt-3 block text-center text-xs font-semibold text-[#566274] hover:text-navy">Lanjut belanja</Link></aside>
    </div>}
  </div>
}