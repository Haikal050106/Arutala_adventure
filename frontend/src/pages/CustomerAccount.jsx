import { useEffect, useState } from 'react'
import { CalendarDays, CircleUserRound, LogOut, PackageCheck, ReceiptText } from 'lucide-react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import PaymentReceipt from '../components/PaymentReceipt'
import { useCustomerStore } from '../components/useCustomerStore'
import { money } from '../lib/customer-shop'

const statusClass = (status) => ['Dibatalkan', 'Ditolak'].includes(status) ? 'bg-slate-100 text-slate-600' : ['Disetujui', 'Dibayar', 'Sedang Disewa', 'Menunggu Pengembalian', 'Selesai'].includes(status) ? 'bg-[#E8F4EA] text-[#24683C]' : 'bg-orange-50 text-[#A94109]'
const rentalDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { dateStyle: 'medium' })
const paymentDate = (date) => new Date(date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
const paymentMethod = { cash: 'Tunai', qris: 'QRIS statis', gateway: 'Payment gateway' }
const paymentStatus = { unpaid: 'Belum dibayar', partially_paid: 'Sebagian dibayar', paid: 'Lunas' }
const rentalStatus = {
  pending_confirmation: 'Menunggu Konfirmasi',
  confirmed: 'Disetujui',
  active: 'Sedang Disewa',
  returned: 'Selesai',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
}

export default function CustomerAccount() {
  const { profile, orders, logout, cancelPurchaseOrder, cancelOrder, authLoading, ordersLoading, ordersError, reloadOrders, rentalsLoading, rentalsError, reloadRentals } = useCustomerStore()
  const [searchParams] = useSearchParams()
  const { notify } = useOutletContext()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('semua')
  const [cancellingOrderId, setCancellingOrderId] = useState(null)
  const [selectedReceipt, setSelectedReceipt] = useState(null)

  useEffect(() => {
    if (!profile) return undefined

    const refreshLedger = () => {
      if (document.visibilityState === 'visible') {
        void Promise.all([reloadOrders(), reloadRentals()])
      }
    }

    refreshLedger()
    window.addEventListener('focus', refreshLedger)
    return () => window.removeEventListener('focus', refreshLedger)
  }, [profile, reloadOrders, reloadRentals])

  if (authLoading) return <div className="mx-auto max-w-xl px-5 py-20 text-center" role="status"><p className="text-sm text-[#566274]">Memeriksa sesi akun...</p></div>
  if (!profile) return <div className="mx-auto max-w-xl px-5 py-20 text-center"><CircleUserRound size={34} className="mx-auto mb-4 text-primary" /><h1 className="text-2xl font-bold text-navy">Masuk untuk melihat akun</h1><p className="mt-2 text-sm text-[#566274]">Masuk dengan akun pelanggan untuk melihat profil Anda.</p><Link to="/masuk?next=/akun" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-white">Masuk / daftar</Link></div>

  const visibleOrders = orders.filter((order) => order.customer.email === profile.email && (
    activeTab === 'semua' ||
    (activeTab === 'payments' ? order.payments?.length > 0 : order.items.some((item) => item.kind === activeTab))
  ))
  const cancel = (orderId) => { cancelOrder(orderId); notify('Status pesanan demo diperbarui menjadi dibatalkan.') }
  const cancelPurchase = async (order) => {
    if (!window.confirm(`Batalkan pesanan ${order.orderNumber || order.id}? Tindakan ini tidak dapat dibatalkan.`)) return

    setCancellingOrderId(order.id)
    try {
      await cancelPurchaseOrder(order.id)
      notify('Pesanan berhasil dibatalkan.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Pesanan gagal dibatalkan. Silakan coba lagi.')
    } finally {
      setCancellingOrderId(null)
    }
  }
  const signOut = async () => {
    const result = await logout()
    notify(result.ok ? 'Kamu sudah keluar dari akun pelanggan.' : `Kamu keluar pada perangkat ini, tetapi sesi server belum dapat dicabut: ${result.message}`)
    navigate('/')
  }
  const createdOrder = searchParams.get('order')
  const confirmationOrder = orders.find((order) => order.id === createdOrder)
  const createdBooking = searchParams.get('booking')
  const confirmationBooking = orders.find((booking) => booking.id === createdBooking && booking.rentalBooking)
  const openReceipt = (order, payment) => setSelectedReceipt({
    payment,
    transaction: {
      type: order.rentalBooking ? 'Penyewaan' : 'Pembelian',
      number: order.orderNumber || order.id,
      createdAt: order.createdAt,
      totalAmount: order.total,
      customer: order.customer,
      items: order.items.map((item) => ({
        ...item,
        subtotal: item.unitPrice * item.quantity * (item.kind === 'rental' ? item.rentalDays : 1),
        detail: item.kind === 'rental'
          ? `Sewa ${rentalDate(item.startDate)}–${rentalDate(item.returnDate)} · ${item.rentalDays} hari · ${money(item.unitPrice)} / unit / hari`
          : `${money(item.unitPrice)} / unit`,
      })),
    },
  })

  return <div className="mx-auto max-w-6xl px-5 py-10 max-md:px-4 max-md:py-7"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Akun pelanggan</p><div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><h1 className="mb-1 text-3xl font-bold tracking-tight text-navy max-sm:text-2xl">Halo, {profile.name}</h1><p className="m-0 text-sm text-[#566274]">{profile.email} · {profile.phone}</p></div><button type="button" onClick={signOut} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DDE2E9] bg-white px-3 text-xs font-semibold text-[#566274] hover:text-navy"><LogOut size={15} />Keluar</button></div>
    {createdOrder && <div className="mb-6 rounded-xl border border-[#C7E4CE] bg-[#F1F8F2] p-4"><div className="flex items-start gap-3"><PackageCheck size={19} className="mt-0.5 text-[#24683C]" /><div><p className="m-0 text-sm font-semibold text-navy">Pesanan demo tercatat</p><p className="mb-0 mt-1 text-xs text-[#566274]">Referensi {createdOrder}. Status: menunggu konfirmasi. Belum ada pembayaran atau konfirmasi dari toko.</p>{confirmationOrder?.customer.villageAddress && <p className="mb-0 mt-2 text-xs text-[#566274]">Alamat Desa/Kelurahan: <b className="text-navy">{confirmationOrder.customer.villageAddress}</b></p>}</div></div></div>}
    {createdBooking && <div className="mb-6 rounded-xl border border-[#C7E4CE] bg-[#F1F8F2] p-4"><div className="flex items-start gap-3"><PackageCheck size={19} className="mt-0.5 text-[#24683C]" /><div><p className="m-0 text-sm font-semibold text-navy">Booking sewa berhasil dikirim</p><p className="mb-0 mt-1 text-xs text-[#566274]">Referensi {confirmationBooking?.orderNumber || createdBooking}. Status: {confirmationBooking?.status === 'Menunggu konfirmasi' && confirmationBooking?.paymentStatus !== 'Lunas' ? 'Menunggu Pembayaran' : confirmationBooking?.status || 'Menunggu Pembayaran'}. Pembayaran dilakukan di toko Arutala Adventure setelah booking dikonfirmasi.</p></div></div></div>}
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]"><aside className="h-fit rounded-xl border border-[#DDE2E9] bg-white p-5"><span className="grid size-12 place-items-center rounded-full bg-navy text-sm font-bold text-white">{profile.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><h2 className="mb-1 mt-3 text-base font-semibold text-navy">Profil pelanggan</h2><p className="mb-0 text-xs leading-relaxed text-[#566274]">Perubahan data profil belum tersinkron ke server.</p><dl className="mt-4 space-y-3 border-t border-[#DDE2E9] pt-4 text-xs"><div><dt className="text-[#566274]">Nama</dt><dd className="mb-0 mt-1 font-semibold text-navy">{profile.name}</dd></div><div><dt className="text-[#566274]">Email</dt><dd className="mb-0 mt-1 break-all font-semibold text-navy">{profile.email}</dd></div><div><dt className="text-[#566274]">Telepon</dt><dd className="mb-0 mt-1 font-semibold text-navy">{profile.phone}</dd></div></dl></aside>
      <section><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="m-0 text-xl font-bold text-navy">{activeTab === 'payments' ? 'Riwayat Pembayaran' : 'Pesanan & booking'}</h2><p className="mb-0 mt-1 text-xs text-[#566274]">{activeTab === 'payments' ? 'Pembayaran dari ledger untuk transaksi milik akun ini.' : 'Riwayat pembelian dan booking sewa dimuat dari server; transaksi tetap terpisah.'}</p></div><div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-[#DDE2E9]">{[['semua', 'Semua'], ['purchase', 'Pembelian'], ['rental', 'Penyewaan'], ['payments', 'Pembayaran']].map(([value, label]) => <button key={value} type="button" onClick={() => setActiveTab(value)} className={`rounded-md px-3 py-2 text-xs font-semibold ${activeTab === value ? 'bg-navy text-white' : 'text-[#566274]'}`}>{label}</button>)}</div></div>
        {ordersError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"><span>Riwayat pesanan gagal dimuat: {ordersError}</span><button type="button" onClick={reloadOrders} className="font-semibold underline">Coba lagi</button></div>}
        {rentalsError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"><span>Riwayat booking gagal dimuat: {rentalsError}</span><button type="button" onClick={reloadRentals} className="font-semibold underline">Coba lagi</button></div>}
        {(ordersLoading || rentalsLoading) && <p role="status" className="mb-4 text-xs text-[#566274]">Memuat riwayat pembelian dan booking...</p>}
        {visibleOrders.length ? <div className="space-y-3">{visibleOrders.map((order) => <article key={`${order.rentalBooking ? 'rental' : 'order'}-${order.id}`} className="rounded-xl border border-[#DDE2E9] bg-white p-4 shadow-[0_2px_12px_rgba(23,43,77,0.04)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-1 text-xs font-bold text-navy">{order.orderNumber || order.id}</p><p className="m-0 flex items-center gap-1 text-[11px] text-[#566274]"><CalendarDays size={13} />{new Date(order.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })} · {order.rentalBooking ? 'Booking sewa' : 'Pembelian'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass(order.status)}`}>{order.status === 'Menunggu konfirmasi' && order.paymentStatus !== 'Lunas' ? 'Menunggu Pembayaran' : order.status}</span></div><div className="mt-3 space-y-2 border-y border-[#DDE2E9] py-3">{order.items.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 text-xs"><span className="text-[#566274]">{item.name} × {item.quantity} · {item.kind === 'rental' ? `Sewa ${rentalDate(item.startDate)}–${rentalDate(item.returnDate)} · ${item.rentalDays} hari · ${money(item.unitPrice)} / unit / hari` : 'Pembelian'}</span><span className="font-semibold text-navy">{money(item.unitPrice * item.quantity * (item.kind === 'rental' ? item.rentalDays : 1))}</span></div>)}{order.items.some((item) => item.kind === 'rental') && <p className="mb-0 pt-1 text-xs text-[#566274]">Alamat Desa/Kelurahan: <b className="text-navy">{order.customer.villageAddress || '—'}</b></p>}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1 text-xs text-[#566274]"><ReceiptText size={14} />Pembayaran: <b className="text-navy">{paymentStatus[order.paymentStatus] || order.paymentStatus}</b> · {money(order.amountPaid || 0)} dibayar</span><b className="text-sm text-navy">Total {money(order.total)}</b></div>{order.payments?.length > 0 && <ol className="mb-0 mt-2 space-y-2 border-t border-[#DDE2E9] pt-2 text-[11px] text-[#566274]">{order.payments.map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2"><span>{payment.reference} · {paymentMethod[payment.method] || payment.method} · {money(payment.amount)} · {payment.status === 'succeeded' ? paymentDate(payment.paidAt) : payment.status}</span><button type="button" onClick={() => openReceipt(order, payment)} className="rounded-md border border-[#DDE2E9] px-2 py-1 font-semibold text-navy hover:bg-slate-50">Lihat struk</button></li>)}</ol>}{order.rentalBooking && order.statusHistories?.length > 0 && <details className="mt-3 border-t border-[#DDE2E9] pt-3"><summary className="cursor-pointer text-xs font-semibold text-navy">Riwayat status penyewaan</summary><ol className="mb-0 mt-2 space-y-2 pl-5 text-[11px] text-[#566274]">{order.statusHistories.map((history) => <li key={history.id}>{history.from_status ? `${rentalStatus[history.from_status] || history.from_status} → ` : 'Booking dibuat → '}{rentalStatus[history.to_status] || history.to_status} · {paymentDate(history.created_at)}{history.changed_by ? ` · ${history.changed_by}` : ''}</li>)}</ol></details>}{order.prototype && order.status === 'Menunggu konfirmasi' && <button type="button" onClick={() => cancel(order.id)} className="mt-3 rounded-lg border border-[#DDE2E9] px-3 py-2 text-xs font-semibold text-[#566274] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">Batalkan permintaan demo</button>}{!order.prototype && !order.rentalBooking && ['Menunggu konfirmasi', 'Dikonfirmasi'].includes(order.status) && <button type="button" disabled={cancellingOrderId === order.id} onClick={() => cancelPurchase(order)} className="mt-3 rounded-lg border border-[#DDE2E9] px-3 py-2 text-xs font-semibold text-[#566274] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60">{cancellingOrderId === order.id ? 'Membatalkan...' : 'Batalkan pesanan'}</button>}{!order.prototype && !order.rentalBooking && !['Menunggu konfirmasi', 'Dikonfirmasi'].includes(order.status) && <p className="mb-0 mt-3 text-xs text-[#566274]">{order.status === 'Dibatalkan' ? 'Pesanan ini sudah dibatalkan.' : `Pesanan berstatus ${order.status.toLowerCase()} tidak dapat dibatalkan karena sudah melewati tahap konfirmasi.`}</p>}</article>)}</div> : ordersLoading || rentalsLoading ? null : <div className="rounded-xl border border-dashed border-[#DDE2E9] bg-white px-6 py-12 text-center"><PackageCheck size={28} className="mx-auto mb-3 text-slate-300" /><h3 className="m-0 text-sm font-semibold text-navy">Belum ada pesanan</h3><p className="mb-4 mt-2 text-xs text-[#566274]">Pesanan pembelian dan booking sewa yang dikirim akan tampil di sini.</p><Link to="/katalog" className="text-xs font-semibold text-[#C94F08]">Jelajahi katalog</Link></div>}</section>
    </div>
    {visibleOrders.some((order) => !order.prototype && order.status !== 'Dibatalkan' && Number(order.balanceDue) > 0) && <section className="mt-5 rounded-xl border border-[#DDE2E9] bg-white p-4"><h3 className="m-0 text-sm font-semibold text-navy">Pembayaran di toko</h3><p className="mb-3 mt-1 text-xs text-[#566274]">Selesaikan pembayaran langsung di toko Arutala Adventure. Kasir akan memeriksa penerimaan uang dan mencatat pembayaran melalui POS; status pembayaran diperbarui dari Payment Ledger backend.</p><div className="space-y-2">{visibleOrders.filter((order) => !order.prototype && order.status !== 'Dibatalkan' && Number(order.balanceDue) > 0).map((order) => <div key={`offline-${order.rentalBooking ? 'rental' : 'order'}-${order.id}`} className="rounded-lg bg-slate-50 p-3"><p className="m-0 text-xs font-semibold text-navy">{order.orderNumber} · {order.rentalBooking ? 'Penyewaan' : 'Pembelian'}</p><p className="mb-0 mt-1 text-xs text-[#566274]">Status: Menunggu Pembayaran · Sisa tagihan {money(order.balanceDue)}</p></div>)}</div></section>}
    {selectedReceipt && <PaymentReceipt {...selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
  </div>
}