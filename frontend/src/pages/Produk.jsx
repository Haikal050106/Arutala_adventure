import { useState } from 'react'
import { Search, Tag } from 'lucide-react'
import Card, { Heading } from '../components/Card'
import ProductPhoto from '../components/ProductPhoto'

const money = (value) => `Rp${Number(value).toLocaleString('id-ID')}`

export default function Produk({ products, onAdd }) {
  const [search, setSearch] = useState('')
  const filtered = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()))
  return <>
    <Heading title="Perlengkapan petualangan" description="Temukan gear pilihan untuk dijual maupun disewa." button="Tambah produk" onClick={onAdd} />
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-1 text-sm font-semibold text-navy">Katalog produk <span className="ml-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-[#C94F08]">{products.length}</span></p><p className="m-0 text-xs text-slate-500">Harga, ketersediaan, dan kategori perlengkapan</p></div>
      <label className="relative block w-full max-w-70"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" /><input className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-navy outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari perlengkapan..." /></label>
    </div>
    {filtered.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {filtered.map((product) => <article className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(23,43,77,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(23,43,77,0.11)]" key={product.id}>
        <div className="relative h-48 overflow-hidden bg-[#E9EDF2]"><ProductPhoto category={product.category} name={product.name} className="size-full" /><span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-navy shadow-sm">{product.category}</span></div>
        <div className="p-4"><div className="flex items-start justify-between gap-3"><h2 className="m-0 text-sm font-semibold leading-snug text-navy">{product.name}</h2><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${product.stock > 5 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-[#C94F08]'}`}>{product.stock} unit</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3"><div><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Harga jual</p><p className="m-0 text-sm font-bold text-navy">{money(product.sale)}</p></div><div><p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><Tag size={12} aria-hidden="true" /> Sewa / hari</p><p className="m-0 text-sm font-bold text-[#C94F08]">{money(product.rent)}</p></div></div>
        </div>
      </article>)}
    </div> : <Card className="p-10 text-center"><Search className="mx-auto mb-3 text-slate-300" size={28} aria-hidden="true" /><p className="m-0 text-sm font-semibold text-navy">Produk tidak ditemukan</p><p className="mb-0 mt-1 text-xs text-slate-500">Coba kata kunci lain.</p></Card>}
  </>
}

export function ProductForm({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', category: 'Tenda', sale: '', rent: '', stock: '' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="fixed inset-0 z-20 grid place-items-center bg-navy/55 p-4 backdrop-blur-sm" onClick={onClose}><form className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-sm:p-5" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, sale: Number(form.sale), rent: Number(form.rent), stock: Number(form.stock) }) }} onClick={(event) => event.stopPropagation()}>
    <button type="button" className="absolute right-4 top-3 grid size-8 place-items-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-navy" onClick={onClose} aria-label="Tutup">×</button><h2 className="m-0 pr-8 text-lg font-bold text-navy">Tambah produk</h2><p className="mt-1 text-sm text-slate-500">Masukkan informasi perlengkapan baru.</p>
    <label className="mt-4 block text-xs font-semibold text-navy">Nama produk<input required className="mt-1.5 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Nama alat" /></label>
    <label className="mt-3 block text-xs font-semibold text-navy">Kategori<select className="mt-1.5 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={form.category} onChange={(event) => update('category', event.target.value)}>{['Tenda', 'Tas & Carrier', 'Alas Kaki', 'Alat Masak', 'Kenyamanan', 'Aksesori'].map((item) => <option key={item}>{item}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-3"><label className="mt-3 block text-xs font-semibold text-navy">Harga jual<input required className="mt-1.5 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" type="number" min="1" value={form.sale} onChange={(event) => update('sale', event.target.value)} /></label><label className="mt-3 block text-xs font-semibold text-navy">Sewa / hari<input required className="mt-1.5 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" type="number" min="0" value={form.rent} onChange={(event) => update('rent', event.target.value)} /></label></div>
    <label className="mt-3 block text-xs font-semibold text-navy">Stok<input required className="mt-1.5 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" type="number" min="0" value={form.stock} onChange={(event) => update('stock', event.target.value)} /></label><button className="mt-5 min-h-11 w-full rounded-lg bg-primary text-sm font-semibold text-white transition hover:bg-[#E7650D]" type="submit">Simpan produk</button>
  </form></div>
}
