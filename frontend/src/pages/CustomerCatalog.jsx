import { useMemo, useState } from 'react'
import { AlertCircle, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useCustomerStore } from '../components/useCustomerStore'
import CustomerProductCard from '../components/CustomerProductCard'

export default function CustomerCatalog() {
  const { products, categories, catalogLoading, catalogError, reloadCatalog } = useCustomerStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialMode = searchParams.get('jenis') === 'sewa' ? 'rental' : 'purchase'
  const [mode, setMode] = useState(initialMode)
  const [category, setCategory] = useState(searchParams.get('kategori') || 'Semua')
  const [search, setSearch] = useState('')
  const categoryOptions = useMemo(() => [{ name: 'Semua' }, ...categories], [categories])
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'Semua' || product.category === category
    return matchesSearch && matchesCategory
  }), [category, products, search])

  const selectMode = (nextMode) => {
    setMode(nextMode)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('jenis', nextMode === 'rental' ? 'sewa' : 'jual')
      return next
    })
  }

  const selectCategory = (name) => {
    setCategory(name)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (name === 'Semua') next.delete('kategori')
      else next.set('kategori', name)
      return next
    })
  }

  return <div className="mx-auto max-w-7xl px-5 py-10 max-md:px-4 max-md:py-7">
    <div className="mb-8"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Pilih gear untuk perjalanan</p><h1 className="mb-2 text-3xl font-bold tracking-tight text-navy max-sm:text-2xl">Katalog perlengkapan</h1><p className="m-0 text-sm text-[#566274]">Harga dan stok dasar dimuat dari katalog Arutala. Ketersediaan akhir perlu konfirmasi toko.</p></div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#DDE2E9] bg-white p-4">
      <div className="inline-flex rounded-lg bg-canvas p-1"><button type="button" onClick={() => selectMode('purchase')} className={`rounded-md px-4 py-2.5 text-sm font-semibold transition ${mode === 'purchase' ? 'bg-white text-navy shadow-sm' : 'text-[#566274] hover:text-navy'}`}>Beli perlengkapan</button><button type="button" onClick={() => selectMode('rental')} className={`rounded-md px-4 py-2.5 text-sm font-semibold transition ${mode === 'rental' ? 'bg-white text-navy shadow-sm' : 'text-[#566274] hover:text-navy'}`}>Sewa alat</button></div>
      <label className="relative w-full max-w-80"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566274]" aria-hidden="true" /><input className="h-11 w-full rounded-lg border border-[#DDE2E9] bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-[#566274] focus:border-primary focus:ring-2 focus:ring-orange-100" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau kategori..." /></label>
    </div>
    <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1"><SlidersHorizontal size={16} className="mr-1 shrink-0 text-[#566274]" aria-hidden="true" /><span className="shrink-0 text-xs font-semibold text-navy">Kategori</span>{categoryOptions.map((item) => <button key={item.name} type="button" onClick={() => selectCategory(item.name)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition ${category === item.name ? 'border-navy bg-navy text-white' : 'border-[#DDE2E9] bg-white text-[#566274] hover:border-primary hover:text-[#C94F08]'}`}>{item.name}</button>)}</div>
    {catalogError && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span className="flex items-center gap-2"><AlertCircle size={16} />Katalog gagal dimuat: {catalogError}</span><button type="button" onClick={reloadCatalog} className="inline-flex items-center gap-2 font-semibold hover:underline"><RefreshCw size={14} />Coba lagi</button></div>}
    {catalogLoading ? <div role="status" className="rounded-xl border border-[#DDE2E9] bg-white px-6 py-14 text-center text-sm text-[#566274]">Memuat katalog dari server...</div> : !catalogError && <>
      <div className="mb-4 flex items-center justify-between"><p className="m-0 text-sm font-semibold text-navy">{filteredProducts.length} perlengkapan</p><span className="text-xs text-[#566274]">{mode === 'purchase' ? 'Harga jual' : 'Tarif sewa per hari'}</span></div>
      {filteredProducts.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filteredProducts.map((product) => <CustomerProductCard key={product.id} product={product} mode={mode} />)}</div> : <div className="rounded-xl border border-dashed border-[#DDE2E9] bg-white px-6 py-14 text-center"><Search size={28} className="mx-auto mb-3 text-slate-300" /><h2 className="m-0 text-base font-semibold text-navy">{products.length ? 'Produk tidak ditemukan' : 'Belum ada produk'}</h2><p className="mb-0 mt-2 text-sm text-[#566274]">{products.length ? 'Ubah kata pencarian atau kategori.' : 'Produk akan tampil di sini setelah tersedia di katalog.'}</p></div>}
    </>}
  </div>
}
