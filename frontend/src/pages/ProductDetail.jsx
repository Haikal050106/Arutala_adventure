import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, CalendarDays, CircleCheck, Info, RefreshCw, ShoppingBag } from 'lucide-react'
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useCustomerStore } from '../components/useCustomerStore'
import { money, rentalDays } from '../lib/customer-shop'
import CustomerImage from '../components/CustomerImage'

const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); return localDate(date) }
const afterTomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 2); return localDate(date) }

export default function ProductDetail() {
  const { productId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { notify } = useOutletContext()
  const { products, orders, catalogLoading, catalogError, reloadCatalog, getSaleAvailable, getRentalAvailable, fetchRentalAvailability, addToCart } = useCustomerStore()
  const product = products.find((item) => item.id === productId)
  const [quantity, setQuantity] = useState(1)
  const [startDate, setStartDate] = useState(tomorrow)
  const [returnDate, setReturnDate] = useState(afterTomorrow)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [selectedPhotoId, setSelectedPhotoId] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState(null)
  const mode = searchParams.get('jenis') === 'sewa' ? 'rental' : 'purchase'
  const variants = useMemo(() => product?.variants || [], [product])
  const modelNames = [...new Set(variants.map((variant) => variant.name))]
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId)
  const selectedModelName = selectedVariant?.name || modelNames[0]
  const modelVariants = variants.filter((variant) => variant.name === selectedModelName)
  const designNames = [...new Set(modelVariants.map((variant) => variant.design_name || 'Default'))]
  const selectedDesignName = selectedVariant?.design_name || designNames[0]
  const designVariants = modelVariants.filter((variant) => (variant.design_name || 'Default') === selectedDesignName)
  const designPhotos = [...new Map(designVariants.flatMap((variant) => variant.photos || [])
    .map((photo) => [photo.id || photo.secure_url, photo])).values()]
  const productPhotos = designPhotos.length ? designPhotos : product?.photos || []
  const variantPrice = mode === 'purchase'
    ? selectedVariant?.salePrice ?? product?.salePrice
    : selectedVariant?.rentPricePerDay ?? product?.rentPricePerDay
  const catalogStock = selectedVariant
    ? mode === 'purchase' ? selectedVariant.saleStock : selectedVariant.rentalStock
    : mode === 'purchase' ? product?.saleStock : product?.rentalStock
  const days = rentalDays(startDate, returnDate)
  const available = mode === 'purchase'
    ? getSaleAvailable(productId, selectedVariant?.id)
    : getRentalAvailable(productId, startDate, returnDate, selectedVariant?.id)
  const similar = useMemo(() => products.filter((item) => item.category === product?.category && item.id !== productId).slice(0, 3), [productId, products, product?.category])

  useEffect(() => {
    setSelectedPhotoId('')
  }, [productId])

  useEffect(() => {
    if (!product) return
    if (!variants.length) {
      setSelectedVariantId(null)
      return
    }
    if (!selectedVariant || !variants.some((variant) => variant.id === selectedVariantId) ||
      (mode === 'purchase' ? selectedVariant.saleStock : selectedVariant.rentalStock) < 1) {
      setSelectedVariantId((variants.find((variant) =>
        (mode === 'purchase' ? variant.saleStock : variant.rentalStock) > 0) || variants[0]).id)
    }
  }, [mode, product, productId, selectedVariant, selectedVariantId, variants])

  useEffect(() => {
    if (mode !== 'rental' || !product || !days) {
      setAvailabilityLoading(false)
      setAvailabilityError('')
      return undefined
    }

    let active = true
    setAvailabilityLoading(true)
    setAvailabilityError('')
    Promise.all((variants.length ? variants.map((variant) => variant.id) : [null]).map((variantId) =>
      fetchRentalAvailability(productId, startDate, returnDate, variantId)))
      .catch((error) => {
        if (active) setAvailabilityError(error instanceof Error ? error.message : 'Ketersediaan sewa tidak dapat dimuat.')
      })
      .finally(() => { if (active) setAvailabilityLoading(false) })

    return () => { active = false }
  }, [days, fetchRentalAvailability, mode, product, productId, returnDate, startDate, variants])

  if (catalogLoading) return <div role="status" className="mx-auto max-w-3xl px-5 py-20 text-center text-sm text-[#566274]">Memuat detail produk...</div>
  if (catalogError) return <div className="mx-auto max-w-3xl px-5 py-20 text-center"><AlertCircle size={28} className="mx-auto mb-3 text-red-500" /><h1 className="text-2xl font-bold text-navy">Detail produk tidak dapat dimuat</h1><p role="alert" className="mt-2 text-sm text-[#566274]">{catalogError}</p><button type="button" onClick={reloadCatalog} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary"><RefreshCw size={15} />Coba lagi</button><Link to="/katalog" className="mt-4 block text-sm font-semibold text-[#566274]">Kembali ke katalog</Link></div>
  if (!product) return <div className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-2xl font-bold text-navy">Produk tidak ditemukan</h1><Link to="/katalog" className="mt-3 inline-flex text-sm font-semibold text-secondary">Kembali ke katalog</Link></div>

  const setMode = (nextMode) => {
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set('jenis', nextMode === 'rental' ? 'sewa' : 'jual'); return next })
  }
  const handleAdd = () => {
    const result = addToCart({ productId, variantId: selectedVariant?.id, kind: mode, quantity, startDate: mode === 'rental' ? startDate : '', returnDate: mode === 'rental' ? returnDate : '' })
    notify(result.message)
    if (result.ok) navigate('/keranjang')
  }
  const activeOrders = orders.filter((order) => order.status === 'Menunggu konfirmasi' || order.status === 'Dikonfirmasi' || order.status === 'Diproses').length
  const selectedPhoto = productPhotos.find((photo) => String(photo.id) === selectedPhotoId)
    || productPhotos.find((photo) => photo.is_primary)
    || productPhotos[0]
  const designPhoto = designVariants.find((variant) => variant.image || variant.photos?.length)
  const mainImage = selectedPhoto?.secure_url || designPhoto?.image || designPhoto?.photos?.[0]?.secure_url || selectedVariant?.image || product.image
  const mainImageAlt = selectedPhoto?.alt_text || designVariants.find((variant) => variant.image)?.imageAlt || selectedVariant?.imageAlt || product.imageAlt
  const availableForVariant = (variant) => mode === 'purchase'
    ? getSaleAvailable(productId, variant.id)
    : getRentalAvailable(productId, startDate, returnDate, variant.id)
  const chooseModel = (modelName) => {
    const option = variants.find((variant) => variant.name === modelName && availableForVariant(variant) > 0)
    if (option) setSelectedVariantId(option.id)
  }
  const chooseDesign = (designName) => {
    const option = modelVariants.find((variant) => (variant.design_name || 'Default') === designName && availableForVariant(variant) > 0)
    if (option) setSelectedVariantId(option.id)
  }
  const chooseOption = (field, value) => {
    const option = designVariants.find((variant) =>
      (field === 'capacity' ? variant.options?.capacity || '' : variant[field] || '') === value &&
      availableForVariant(variant) > 0)
    if (option) setSelectedVariantId(option.id)
  }

  return <div className="mx-auto max-w-7xl px-5 py-8 max-md:px-4 max-md:py-5">
    <Link to="/katalog" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#566274] hover:text-navy"><ArrowLeft size={16} />Kembali ke katalog</Link>
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <div className="overflow-hidden rounded-2xl border border-[#DDE2E9] bg-white shadow-[0_4px_18px_rgba(37,37,37,0.07)]"><CustomerImage src={mainImage} alt={mainImageAlt} className="aspect-4/3" /><div className="flex items-center justify-between gap-3 border-t border-[#DDE2E9] px-4 py-3 text-xs text-[#566274]"><span>{product.category} · Foto {selectedVariant?.image || productPhotos.length ? 'produk' : product.image_url ? 'produk' : 'ilustrasi kategori'}</span><span className="rounded-full bg-canvas px-2.5 py-1">Katalog API</span></div></div>
        {productPhotos.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto" aria-label="Galeri foto desain">{productPhotos.map((photo) => <button key={photo.id || photo.secure_url} type="button" onClick={() => setSelectedPhotoId(String(photo.id || photo.secure_url))} aria-label={`Tampilkan foto ${photo.position || ''}`} aria-pressed={String(selectedPhoto?.id || selectedPhoto?.secure_url) === String(photo.id || photo.secure_url)} className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${String(selectedPhoto?.id || selectedPhoto?.secure_url) === String(photo.id || photo.secure_url) ? 'border-primary' : 'border-transparent'}`}><CustomerImage src={photo.secure_url} alt={photo.alt_text || product.name} className="size-full" /></button>)}</div>}
      </div>
      <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{product.category}</p><h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-navy max-sm:text-2xl">{product.name}</h1><p className="mb-6 text-sm leading-relaxed text-[#566274]">{product.description}</p>
        <div className="mb-5 inline-flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-[#DDE2E9]"><button type="button" onClick={() => setMode('purchase')} className={`rounded-md px-4 py-2.5 text-sm font-semibold ${mode === 'purchase' ? 'bg-primary text-white' : 'text-[#566274] hover:text-primary'}`}>Beli</button><button type="button" onClick={() => setMode('rental')} className={`rounded-md px-4 py-2.5 text-sm font-semibold ${mode === 'rental' ? 'bg-primary text-white' : 'text-[#566274] hover:text-primary'}`}>Sewa</button></div>
        {variants.length > 0 && <section className="mb-5 space-y-4 rounded-xl border border-[#DDE2E9] bg-white p-4" aria-label="Pilihan model produk"><div><h2 className="mb-2 text-sm font-semibold text-navy">Pilih model</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{modelNames.filter((name) => variants.some((variant) => variant.name === name && availableForVariant(variant) > 0)).map((name) => {
          const modelVariant = variants.find((variant) => variant.name === name && (variant.image || variant.photos?.length)) || variants.find((variant) => variant.name === name)
          return <button key={name} type="button" disabled={availabilityLoading || Boolean(availabilityError)} aria-pressed={name === selectedModelName} onClick={() => chooseModel(name)} className={`overflow-hidden rounded-xl border text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${name === selectedModelName ? 'border-primary ring-2 ring-primary/30' : 'border-[#DDE2E9] hover:border-primary'}`}><CustomerImage src={modelVariant?.image || modelVariant?.photos?.[0]?.secure_url || product.image} alt={modelVariant?.imageAlt || name} className="aspect-[4/3]" /><span className="block p-2 text-xs font-semibold text-navy">{name}</span></button>
        })}</div></div>
          <div><h2 className="mb-2 text-sm font-semibold text-navy">Pilih desain dari foto</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{designNames.filter((designName) => modelVariants.some((variant) => (variant.design_name || 'Default') === designName && availableForVariant(variant) > 0)).map((designName) => {
            const designVariant = modelVariants.find((variant) => (variant.design_name || 'Default') === designName && (variant.image || variant.photos?.length)) || modelVariants.find((variant) => (variant.design_name || 'Default') === designName)
            return <button key={designName} type="button" disabled={availabilityLoading || Boolean(availabilityError)} aria-pressed={designName === selectedDesignName} onClick={() => chooseDesign(designName)} className={`overflow-hidden rounded-xl border text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${designName === selectedDesignName ? 'border-primary ring-2 ring-primary/30' : 'border-[#DDE2E9] hover:border-primary'}`}><CustomerImage src={designVariant?.image || designVariant?.photos?.[0]?.secure_url || product.image} alt={designVariant?.imageAlt || designName} className="aspect-[4/3]" /><span className="block p-2 text-xs font-semibold text-navy">{designName}</span></button>
          })}</div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[['Warna', 'color'], ['Ukuran', 'size'], ['Kapasitas', 'capacity']].map(([label, field]) => {
              const valueFor = (variant) => field === 'capacity' ? variant.capacity || variant.options?.capacity || '' : variant[field] || ''
              const choices = [...new Set(designVariants.filter((variant) => valueFor(variant) && availableForVariant(variant) > 0).map(valueFor))]
              if (!choices.length) return null
              return <label key={field} className="text-xs font-semibold text-navy">{label}<select value={selectedVariant ? valueFor(selectedVariant) : ''} disabled={availabilityLoading || Boolean(availabilityError)} onChange={(event) => chooseOption(field, event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#DDE2E9] bg-white px-3 text-sm font-normal"><option value="">Pilih {label.toLowerCase()}</option>{choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></label>
            })}
          </div>
          {selectedVariant && Object.keys(selectedVariant.options || {}).length > 0 && <p className="m-0 text-xs text-[#566274]">{Object.entries(selectedVariant.options).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>}
        </section>}
        <div className="mb-5 rounded-xl border border-[#DDE2E9] bg-white p-4"><p className="mb-1 text-xs font-medium text-[#566274]">{mode === 'purchase' ? 'Harga jual' : 'Harga sewa'}</p><p className="m-0 text-2xl font-bold text-primary">{money(variantPrice)}{mode === 'rental' && <span className="ml-1 text-sm font-medium text-[#566274]">/ hari</span>}</p>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-canvas p-3 text-xs leading-relaxed text-[#566274]"><Info size={15} className="mt-0.5 shrink-0 text-primary" /><span>Stok katalog API untuk pilihan ini: {catalogStock} unit. Ketersediaan sewa dihitung server berdasarkan tanggal yang dipilih dan tetap divalidasi kembali saat booking.</span></div>
        </div>
        {mode === 'rental' && <div className="mb-5 rounded-xl border border-[#DDE2E9] bg-white p-4"><div className="mb-3 flex items-center gap-2"><CalendarDays size={17} className="text-primary" /><h2 className="m-0 text-sm font-semibold text-navy">Jadwal penyewaan</h2></div><div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1"><label className="text-xs font-semibold text-navy">Tanggal mulai<input type="date" min={localDate(new Date())} value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#DDE2E9] px-3 text-sm font-normal focus:border-primary focus:outline-none" /></label><label className="text-xs font-semibold text-navy">Tanggal kembali<input type="date" min={startDate || localDate(new Date())} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#DDE2E9] px-3 text-sm font-normal focus:border-primary focus:outline-none" /></label></div>{days > 0 && <p className="mb-0 mt-3 text-xs text-[#566274]">Durasi {days} hari · subtotal <b className="text-primary">{money(variantPrice * days * quantity)}</b></p>}</div>}
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[#DDE2E9] bg-white p-4"><div><p className="mb-1 text-xs font-semibold text-navy">Jumlah unit</p><p className="m-0 flex items-center gap-1 text-xs text-[#566274]"><CircleCheck size={14} className="text-primary" />{mode === 'rental' ? availabilityLoading ? 'Memeriksa ketersediaan...' : availabilityError ? 'Ketersediaan gagal dimuat' : `${available} unit tersedia untuk tanggal ini` : `${available} unit tersedia`}</p>{availabilityError && <p role="alert" className="mb-0 mt-1 text-xs text-red-700">{availabilityError}</p>}</div><div className="flex items-center gap-3"><button type="button" aria-label="Kurangi jumlah" className="grid size-9 place-items-center rounded-lg border border-[#DDE2E9]" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><input aria-label="Jumlah unit" type="number" min="1" max={Math.max(available, 1)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="w-12 text-center text-sm font-semibold text-navy outline-none" /><button type="button" aria-label="Tambah jumlah" disabled={quantity >= available || availabilityLoading} className="grid size-9 place-items-center rounded-lg border border-[#DDE2E9] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => setQuantity((value) => value + 1)}>+</button></div></div>
        <button type="button" disabled={!available || quantity > available || (variants.length > 0 && !selectedVariant) || (mode === 'rental' && (days === 0 || availabilityLoading || Boolean(availabilityError)))} onClick={handleAdd} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-secondary transition hover:bg-secondary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"><ShoppingBag size={17} />{mode === 'purchase' ? 'Tambah ke keranjang' : 'Tambah booking sewa'}</button>
        {activeOrders > 0 && <p className="mb-0 mt-3 text-xs text-[#566274]">{activeOrders} pesanan/booking aktif di akun ini ikut diperhitungkan pada estimasi browser.</p>}
      </section>
    </div>
    {similar.length > 0 && <section className="mt-12 border-t border-[#DDE2E9] pt-8"><h2 className="mb-4 text-xl font-bold text-navy">Perlengkapan sejenis</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{similar.map((item) => <Link key={item.id} to={`/produk/${item.id}?jenis=${mode === 'rental' ? 'sewa' : 'jual'}`} className="flex items-center gap-3 rounded-xl border border-[#DDE2E9] bg-white p-3"><CustomerImage src={item.image} alt={item.imageAlt} className="size-16 shrink-0 rounded-lg" /><span><b className="block text-sm text-navy">{item.name}</b><small className="mt-1 block text-xs text-[#566274]">{item.category}</small></span></Link>)}</div></section>}
  </div>
}