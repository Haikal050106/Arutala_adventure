import { useState } from 'react'
import { Search } from 'lucide-react'
import Card, { Heading } from '../components/Card'

const money = (value) => `Rp${Number(value).toLocaleString('id-ID')}`

export default function Transaksi({ transactions }) {
  const [search, setSearch] = useState('')
  const filtered = transactions.filter((item) => `${item.id} ${item.customer} ${item.item}`.toLowerCase().includes(search.toLowerCase()))
  return <><Heading title="Riwayat transaksi" description="Semua transaksi penjualan dan penyewaan." /><Card className="overflow-hidden"><div className="flex min-h-22 items-center justify-between gap-4 px-5 max-sm:flex-col max-sm:items-start max-sm:py-4"><div><h2 className="m-0 text-sm font-semibold text-navy">Semua transaksi</h2><p className="mb-0 mt-1 text-xs text-slate-500">{transactions.length} transaksi tersimpan</p></div><label className="relative block w-full max-w-65"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} aria-hidden="true" /><input className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/25" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari transaksi..." /></label></div><TransactionTable transactions={filtered} /></Card></>
}

export function TransactionTable({ transactions }) {
  return <div className="w-full overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-left"><thead className="bg-canvas text-[10px] font-semibold uppercase tracking-wide text-slate-500"><tr>{['ID transaksi', 'Pelanggan', 'Jenis', 'Produk', 'Tanggal', 'Total'].map((column) => <th className="h-11 border-y border-slate-200/80 px-4" key={column}>{column}</th>)}</tr></thead><tbody>{transactions.map((transaction) => <tr className="border-b border-slate-100 text-xs text-slate-600 transition hover:bg-[#FAFBFC] last:border-0" key={transaction.id}><td className="h-14 px-4"><b className="font-semibold text-navy">{transaction.id}</b></td><td className="px-4 font-medium text-navy">{transaction.customer}</td><td className="px-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${transaction.type === 'Sewa' ? 'bg-[#EEF2F7] text-navy' : 'bg-sand/40 text-secondary'}`}>{transaction.type}</span></td><td className="max-w-57.5 truncate px-4">{transaction.item}</td><td className="px-4">{transaction.date}</td><td className="px-4"><b className="font-semibold text-navy">{money(transaction.total)}</b></td></tr>)}</tbody></table>{!transactions.length && <p className="p-8 text-center text-sm text-slate-500">Belum ada transaksi.</p>}</div>
}
