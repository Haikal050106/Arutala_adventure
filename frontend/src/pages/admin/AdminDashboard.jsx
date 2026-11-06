import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ClipboardList, UsersRound, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { adminApiRequest, readAdminToken } from '../../lib/admin-api'
import { money } from '../../lib/customer-shop'

const today = () => new Date().toLocaleDateString('en-CA')
const daysAgo = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toLocaleDateString('en-CA')
}
const statusLabels = { pending_confirmation: 'Menunggu konfirmasi', confirmed: 'Dikonfirmasi' }
const dateLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
const dateTime = (value) => new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
const errorMessage = (error) => error instanceof Error ? error.message : 'Dashboard gagal dimuat dari server.'

function RevenueChart({ values, period }) {
  const max = Math.max(1, ...values.map((entry) => Number(entry.total)))
  const labelStep = Math.max(1, Math.ceil(values.length / 8))
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="m-0 text-base font-semibold text-navy">Pendapatan {period === 'daily' ? 'harian' : 'bulanan'}</h2><p className="mb-0 mt-1 text-xs text-slate-500">Berdasarkan waktu pembayaran berhasil di ledger.</p></div>
      <div className="flex gap-4 text-[11px] text-slate-600"><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-sand/400" />Pembelian</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-blue-500" />Penyewaan</span></div>
    </div>
    {values.length ? <div className="mt-5">
      <div className="flex h-48 items-end gap-1 border-b border-l border-slate-200 px-2">
        {values.map((entry, index) => {
          const purchaseHeight = Number(entry.purchase) / max * 100
          const rentalHeight = Number(entry.rental) / max * 100
          return <div key={entry.date} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
            <div className="flex w-full max-w-8 flex-col justify-end overflow-hidden rounded-t-sm" style={{ height: `${purchaseHeight + rentalHeight}%` }}>
              <span className="block bg-blue-500" style={{ height: `${rentalHeight / Math.max(1, purchaseHeight + rentalHeight) * 100}%` }} />
              <span className="block bg-sand/400" style={{ height: `${purchaseHeight / Math.max(1, purchaseHeight + rentalHeight) * 100}%` }} />
            </div>
            <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-md bg-navy px-2 py-1 text-[10px] text-white shadow group-hover:block">
              {entry.date} · Pembelian {money(entry.purchase)} · Sewa {money(entry.rental)}
            </div>
            {index % labelStep === 0 && <span className="absolute top-full mt-2 whitespace-nowrap text-[9px] text-slate-500">{period === 'monthly' ? entry.date : dateLabel(entry.date)}</span>}
          </div>
        })}
      </div>
      {!values.some((entry) => Number(entry.total) > 0) && <p className="mb-0 mt-8 text-center text-xs text-slate-500">Belum ada Payment berhasil pada rentang tanggal ini.</p>}
    </div> : <p className="mb-0 mt-8 text-center text-xs text-slate-500">Tidak ada data grafik.</p>}
  </section>
}

function TopProducts({ title, products, emptyLabel }) {
  const max = Math.max(1, ...products.map((product) => Number(product.quantity)))
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="m-0 text-base font-semibold text-navy">{title}</h2>
    <div className="mt-4 space-y-4">
      {products.map((product, index) => <div key={product.product_id}>
        <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="font-medium text-navy">{index + 1}. {product.name}</span><strong className="whitespace-nowrap text-slate-600">{product.quantity} unit</strong></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: `${Number(product.quantity) / max * 100}%` }} /></div>
      </div>)}
      {!products.length && <p className="mb-0 text-xs text-slate-500">{emptyLabel}</p>}
    </div>
  </section>
}

function PendingTable({ title, records, type, href }) {
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div><h2 className="m-0 text-sm font-semibold text-navy">{title}</h2><p className="mb-0 mt-1 text-[11px] text-slate-500">{records.length} perlu ditindaklanjuti</p></div>
      <Link to={href} className="text-xs font-semibold text-secondary hover:underline">Kelola</Link>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><tr>{['Nomor', 'Pelanggan', 'Total transaksi', 'Status', 'Tanggal'].map((column) => <th key={column} className="h-10 whitespace-nowrap px-4">{column}</th>)}</tr></thead>
        <tbody>{records.map((record) => <tr key={record.id} className="border-t border-slate-100 text-xs text-slate-600">
          <td className="px-4 py-3 font-semibold text-navy">{record.number}</td><td className="px-4">{record.customer}</td><td className="whitespace-nowrap px-4">{money(record.total_amount)}</td>
          <td className="px-4">{statusLabels[record.status] || record.status}</td><td className="whitespace-nowrap px-4">{dateTime(record.created_at)}</td>
        </tr>)}
        {!records.length && <tr><td colSpan={5} className="h-16 text-center text-xs text-slate-500">Tidak ada {type} yang menunggu proses pada rentang ini.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>
}

export default function AdminDashboard() {
  const [startDate, setStartDate] = useState(() => daysAgo(29))
  const [endDate, setEndDate] = useState(today)
  const [period, setPeriod] = useState('daily')
  const [filters, setFilters] = useState({ startDate: daysAgo(29), endDate: today(), period: 'daily' })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        start_date: filters.startDate,
        end_date: filters.endDate,
        period: filters.period,
      })
      const payload = await adminApiRequest(`/dashboard?${params}`, { token: readAdminToken() })
      setReport(payload)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadReport() }, [loadReport])

  const stats = useMemo(() => report ? [
    { label: 'Total pendapatan', value: money(report.revenue.total), note: `Pembelian ${money(report.revenue.purchase)} · Sewa ${money(report.revenue.rental)}`, icon: Wallet, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Transaksi pembelian', value: report.transactions.purchases, note: 'Order dibuat pada rentang tanggal', icon: ClipboardList, tone: 'bg-sand/40 text-secondary' },
    { label: 'Transaksi penyewaan', value: report.transactions.rentals, note: 'Rental dibuat pada rentang tanggal', icon: CalendarDays, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Pelanggan', value: report.customers.total, note: `${report.customers.online} online · ${report.customers.offline} offline`, icon: UsersRound, tone: 'bg-emerald-50 text-emerald-700' },
  ] : [], [report])

  const applyFilters = (event) => {
    event.preventDefault()
    if (startDate > endDate) {
      setError('Tanggal mulai tidak boleh setelah tanggal akhir.')
      return
    }
    setFilters({ startDate, endDate, period })
  }

  const pendingCount = (report?.pending_orders.length || 0) + (report?.pending_rentals.length || 0)

  return <div>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Ringkasan usaha · Data database</p><h1 className="m-0 text-2xl font-bold tracking-tight text-navy max-sm:text-xl">Dashboard Admin</h1><p className="mb-0 mt-2 text-sm text-slate-600">Pendapatan berasal dari Payment berstatus berhasil.</p></div>
      <Link to="/admin/payments" className="text-xs font-semibold text-secondary hover:underline">Lihat riwayat pembayaran</Link>
    </div>
    <form onSubmit={applyFilters} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="text-xs font-semibold text-navy">Dari tanggal<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 block h-10 rounded-lg border border-slate-200 px-3 text-xs font-normal" /></label>
      <label className="text-xs font-semibold text-navy">Sampai tanggal<input type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1.5 block h-10 rounded-lg border border-slate-200 px-3 text-xs font-normal" /></label>
      <label className="text-xs font-semibold text-navy">Grafik<select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1.5 block h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal"><option value="daily">Harian</option><option value="monthly">Bulanan</option></select></label>
      <button type="submit" disabled={loading} className="h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-secondary disabled:opacity-50">Terapkan filter</button>
      <span className="ml-auto text-[11px] text-slate-500">{filters.startDate} – {filters.endDate}</span>
    </form>

    {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"><span>{error}</span><button type="button" onClick={loadReport} className="font-semibold underline">Coba lagi</button></div>}
    {loading && !report && <p role="status" className="py-12 text-center text-sm text-slate-500">Memuat dashboard dari database...</p>}
    {!loading && !report && !error && <p className="py-12 text-center text-sm text-slate-500">Data dashboard belum tersedia.</p>}
    {report && <>
      <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan usaha">
        {stats.map(({ label, value, note, icon, tone }) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className={`grid size-10 place-items-center rounded-lg ${tone}`}>{createElement(icon, { size: 19, 'aria-hidden': true })}</span>
          <p className="mb-1 mt-4 text-xs font-medium text-slate-500">{label}</p><p className="m-0 text-2xl font-bold tracking-tight text-navy">{value}</p><p className="mb-0 mt-1 text-[11px] text-slate-500">{note}</p>
        </article>)}
      </section>
      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <RevenueChart values={report.revenue_chart} period={filters.period} />
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h2 className="m-0 text-base font-semibold text-navy">Menunggu proses</h2><p className="mb-0 mt-1 text-xs text-slate-500">Order dan booking dalam antrean operasional.</p></div><span className="grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-700">{createElement(ClipboardList, { size: 17, 'aria-hidden': true })}</span></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-50 p-3"><p className="m-0 text-[11px] text-slate-500">Pesanan</p><strong className="mt-1 block text-2xl text-navy">{report.pending_orders.length}</strong></div><div className="rounded-lg bg-slate-50 p-3"><p className="m-0 text-[11px] text-slate-500">Booking sewa</p><strong className="mt-1 block text-2xl text-navy">{report.pending_rentals.length}</strong></div></div>
          <p className="mb-0 mt-3 text-[10px] text-slate-500">{pendingCount ? 'Daftar terbaru dibatasi 8 per jenis.' : 'Tidak ada transaksi yang menunggu proses.'}</p>
        </section>
      </div>
      <div className="mb-5 grid gap-5 md:grid-cols-2"><TopProducts title="Produk terlaris" products={report.top_selling_products} emptyLabel="Belum ada penjualan pada rentang tanggal ini." /><TopProducts title="Paling sering disewa" products={report.top_rented_products} emptyLabel="Belum ada penyewaan pada rentang tanggal ini." /></div>
      <div className="grid gap-5 xl:grid-cols-2"><PendingTable title="Pesanan menunggu proses" records={report.pending_orders} type="pesanan" href="/admin/orders" /><PendingTable title="Booking menunggu proses" records={report.pending_rentals} type="booking" href="/admin/rentals" /></div>
      <p className="mb-0 mt-4 text-[11px] leading-relaxed text-slate-500">Pendapatan menjumlahkan setiap Payment sukses satu kali berdasarkan waktu pembayaran; transaksi dibatalkan tidak masuk daftar produk terlaris atau sewa terbanyak.</p>
    </>}
  </div>
}
