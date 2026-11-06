import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CircleCheck, PackageCheck } from 'lucide-react'
import { useCustomerStore } from '../components/useCustomerStore'
import { money } from '../lib/customer-shop'

export default function CustomerOrderConfirmation() {
  const { orderId } = useParams()
  const { orders, profile, authLoading, fetchCustomerOrder } = useCustomerStore()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (order?.id === orderId && !order.prototype && order.customer.email === profile?.email) return
    const savedOrder = orders.find((item) => item.id === orderId
      && !item.prototype
      && item.customer.email === profile?.email)
    if (savedOrder) {
      setOrder(savedOrder)
      return
    }
    if (authLoading || !profile) return

    let active = true
    setLoading(true)
    setError('')
    fetchCustomerOrder(orderId)
      .then((result) => { if (active) setOrder(result) })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Pesanan tidak dapat dimuat.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [authLoading, fetchCustomerOrder, order, orderId, orders, profile])

  if (authLoading || loading) return <div className="mx-auto max-w-xl px-5 py-20 text-center" role="status"><p className="text-sm text-[#566274]">Memuat konfirmasi pesanan...</p></div>

  if (!profile) return <div className="mx-auto max-w-xl px-5 py-20 text-center"><h1 className="text-2xl font-bold text-navy">Masuk untuk melihat pesanan</h1><p className="mt-2 text-sm text-[#566274]">Pesanan hanya dapat dilihat oleh pelanggan yang membuatnya.</p><Link to="/masuk?next=/akun" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-secondary">Masuk kembali</Link></div>

  if (error || !order || order.prototype || order.customer.email !== profile.email) return <div className="mx-auto max-w-xl px-5 py-20 text-center"><PackageCheck size={34} className="mx-auto mb-4 text-slate-300" /><h1 className="text-2xl font-bold text-navy">Konfirmasi pesanan tidak tersedia</h1><p role="alert" className="mt-2 text-sm text-[#566274]">{error || 'Pesanan tidak ditemukan pada akun ini.'}</p><Link to="/akun" className="mt-5 inline-flex text-sm font-semibold text-secondary">Kembali ke akun</Link></div>

  return <div className="mx-auto max-w-3xl px-5 py-12 max-md:px-4">
    <section className="rounded-2xl border border-[#DDE2E9] bg-white p-7 shadow-[0_8px_32px_rgba(77,42,0,0.07)] max-sm:p-5">
      <div className="mb-5 grid size-12 place-items-center rounded-full bg-[#E8F4EA] text-[#24683C]"><CircleCheck size={25} /></div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Pesanan tersimpan</p>
      <h1 className="mb-2 text-2xl font-bold text-navy">Terima kasih, pesanan Anda sudah diterima.</h1>
      <p className="m-0 text-sm leading-relaxed text-[#566274]">Pembayaran dilakukan langsung di toko Arutala Adventure. Checkout tidak mencatat pembayaran; kasir mengonfirmasi setelah uang benar-benar diterima.</p>
      <div className="mt-6 rounded-xl bg-canvas p-4"><p className="mb-1 text-xs text-[#566274]">Nomor pesanan</p><p className="m-0 font-bold text-navy">{order.orderNumber || order.id}</p><p className="mb-0 mt-2 text-xs text-[#566274]">Status pesanan: <b className="text-navy">{order.status === 'Menunggu konfirmasi' && order.paymentStatus !== 'Lunas' ? 'Menunggu Pembayaran' : order.status}</b></p><p className="mb-0 mt-1 text-xs text-[#566274]">Status pembayaran: <b className="text-navy">{order.paymentStatus}</b></p><p className="mb-0 mt-1 text-xs text-[#566274]">Nominal dibayar: <b className="text-navy">{money(order.amountPaid || 0)}</b></p></div>
      <div className="mt-5 space-y-3">{order.items.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span className="text-[#566274]">{item.name} × {item.quantity}</span><b className="shrink-0 text-navy">{money(item.unitPrice * item.quantity)}</b></div>)}</div>
      <div className="mt-5 flex justify-between border-t border-[#DDE2E9] pt-4"><span className="font-semibold text-navy">Total server</span><strong className="text-lg text-navy">{money(order.total)}</strong></div>
      <div className="mt-6 flex flex-wrap gap-3"><Link to="/akun" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-secondary hover:bg-secondary hover:text-white">Lihat riwayat pesanan</Link><Link to="/katalog" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#DDE2E9] px-5 text-sm font-semibold text-navy">Lanjut belanja</Link></div>
    </section>
  </div>
}
