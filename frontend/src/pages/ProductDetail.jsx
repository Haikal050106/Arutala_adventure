import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, CalendarDays, CircleCheck, Info, RefreshCw, ShoppingBag } from 'lucide-react'
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useCustomerStore } from '../components/useCustomerStore'
import { money, rentalDays } from '../lib/customer-shop'
import CustomerImage from '../components/CustomerImage'
import { SHOE_SIZES } from '../lib/shoe-constants'

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
  const [rentalSize, setRentalSize] = useState('38')
  const mode = searchParams.get('jenis') === 'sewa' ? 'rental' : 'purchase'
  const shoeProduct = Boolean(product?.isShoe)
  const productPhotos = product?.photos || []
  const unitPrice = mode === 'purchase' ? product?.salePrice : product?.rentPricePerDay
  const selectedSizeStock = product?.shoeSizes?.find((item) => item.size === rentalSize)
  const catalogStock = shoeProduct
    ? mode === 'purchase' ? selectedSizeStock?.saleStock || 0 : selectedSizeStock?.rentalStock || 0
    : mode === 'purchase' ? product?.saleStock : product?.rentalStock
  const days = rentalDays(startDate, returnDate)
  const available = mode === 'purchase'
    ? getSaleAvailable(productId, shoeProduct ? rentalSize : '')
    : getRentalAvailable(productId, startDate, returnDate, shoeProduct ? rentalSize : '')
  const similar = useMemo(() => products.filter((item) => item.category === product?.category && item.id !== productId).slice(0, 3), [productId, products, product?.category])

  useEffect(() => {
    setSelectedPhotoId('')
  }, [productId])

  useEffect(() => {
    if (mode !== 'rental' || !product || !days) {
      setAvailabilityLoading(false)
      setAvailabilityError('')
      return undefined
    }

    let active = true
    setAvailabilityLoading(true)
    setAvailabilityError('')
    fetchRentalAvailability(productId, startDate, returnDate, shoeProduct ? rentalSize : '')
      .catch((error) => {
        if (active) setAvailabilityError(error instanceof Error ? error.message : 'Ketersediaan sewa tidak dapat dimuat.')
      })
      .finally(() => { if (active) setAvailabilityLoading(false) })

    return () => { active = false }
  }, [days, fetchRentalAvailability, mode, product, productId, rentalSize, returnDate, shoeProduct, startDate])

  if (catalogLoading) return <div role="status" className="mx-auto max-w-3xl px-5 py-20 text-center text-sm text-[#566274]">Memuat detail produk...</div>
  if (catalogError) return <div className="mx-auto max-w-3xl px-5 py-20 text-center"><AlertCircle size={28} className="mx-auto mb-3 text-red-500" /><h1 className="text-2xl font-bold text-navy">Detail produk tidak dapat dimuat</h1><p role="alert" className="mt-2 text-sm text-[#566274]">{catalogError}</p><button type="button" onClick={reloadCatalog} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary"><RefreshCw size={15} />Coba lagi</button><Link to="/katalog" className="mt-4 block text-sm font-semibold text-[#566274]">Kembali ke katalog</Link></div>
  if (!product) return <div className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-2xl font-bold text-navy">Produk tidak ditemukan</h1><Link to="/katalog" className="mt-3 inline-flex text-sm font-semibold text-secondary">Kembali ke katalog</Link></div>

  const setMode = (nextMode) => {
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set('jenis', nextMode === 'rental' ? 'sewa' : 'jual'); return next })
  }
  const handleAdd = () => {
    const result = addToCart({
      productId,
      kind: mode,
      quantity,
      startDate: mode === 'rental' ? startDate : '',
      returnDate: mode === 'rental' ? returnDate : '',
      size: shoeProduct ? rentalSize : '',
    })
    notify(result.message)
    if (result.ok) navigate('/keranjang')
  }
  const activeOrders = orders.filter((order) => order.status === 'Menunggu konfirmasi' || order.status === 'Dikonfirmasi' || order.status === 'Diproses').length
  const selectedPhoto = productPhotos.find((photo) => String(photo.id) === selectedPhotoId)
    || productPhotos.find((photo) => photo.is_primary)
    || productPhotos[0]
  const mainImage = selectedPhoto?.secure_url || product.image
  const mainImageAlt = selectedPhoto?.alt_text || product.imageAlt

  return <div className="mx-auto max-w-7xl px-5 py-8 max-md:px-4 max-md:py-5">
    <Link to="/katalog" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#566274] hover:text-navy"><ArrowLeft size={16} />Kembali ke katalog</Link>
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <div className="overflow-hidden rounded-2xl border border-[#DDE2E9] bg-white shadow-[0_4px_18px_rgba(37,37,37,0.07)]"><CustomerImage src={mainImage} alt={mainImageAlt} className="aspect-4/3" /><div className="flex items-center justify-between gap-3 border-t border-[#DDE2E9] px-4 py-3 text-xs text-[#566274]"><span>{product.category} · Foto {productPhotos.length ? 'produk' : product.image_url ? 'produk' : 'ilustrasi kategori'}</span><span className="rounded-full bg-canvas px-2.5 py-1">Katalog API</span></div></div>
        {productPhotos.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto" aria-label="Galeri foto desain">{productPhotos.map((photo) => <button key={photo.id || photo.secure_url} type="button" onClick={() => setSelectedPhotoId(String(photo.id || photo.secure_url))} aria-label={`Tampilkan foto ${photo.position || ''}`} aria-pressed={String(selectedPhoto?.id || selectedPhoto?.secure_url) === String(photo.id || photo.secure_url)} className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${String(selectedPhoto?.id || selectedPhoto?.secure_url) === String(photo.id || photo.secure_url) ? 'border-primary' : 'border-transparent'}`}><CustomerImage src={photo.secure_url} alt={photo.alt_text || product.name} className="size-full" /></button>)}</div>}
      </div>
      <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{product.category}</p><h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-navy max-sm:text-2xl">{product.name}</h1><p className="mb-6 text-sm leading-relaxed text-[#566274]">{product.description}</p>
        <div className="mb-5 inline-flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-[#DDE2E9]"><button type="button" onClick={() => setMode('purchase')} className={`rounded-md px-4 py-2.5 text-sm font-semibold ${mode === 'purchase' ? 'bg-primary text-white' : 'text-[#566274] hover:text-primary'}`}>Beli</button><button type="button" onClick={() => setMode('rental')} className={`rounded-md px-4 py-2.5 text-sm font-semibold ${mode === 'rental' ? 'bg-primary text-white' : 'text-[#566274] hover:text-primary'}`}>Sewa</button></div>
        {shoeProduct && <section className="mb-5 rounded-xl border border-[#DDE2E9] bg-white p-4" aria-label="Pilihan ukuran sepatu">
          <h2 className="mb-3 text-sm font-semibold text-navy">Pilih ukuran sepatu</h2>
          <div className="grid grid-cols-6 gap-2 max-sm:grid-cols-3">
            {SHOE_SIZES.map((size) => {
              const stock = product.shoeSizes?.find((item) => item.size === size)
              const sizeAvailable = mode === 'purchase' ? stock?.saleStock > 0 : stock?.rentalStock > 0
              return <button key={size} type="button" disabled={!sizeAvailable} aria-pressed={rentalSize === size} onClick={() => setRentalSize(size)} className={`h-10 rounded-lg border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${rentalSize === size ? 'border-navy bg-navy text-white' : 'border-[#DDE2E9] bg-white text-navy hover:border-primary'}`}>{size}</button>
            })}
          </div>
          {mode === 'rental' && <p className="mb-0 mt-3 text-xs text-[#566274]">Admin menentukan sepatu fisik yang diberikan berdasarkan stok ukuran ini.</p>}
        </section>}
        <div className="mb-5 rounded-xl border border-[#DDE2E9] bg-white p-4"><p className="mb-1 text-xs font-medium text-[#566274]">{mode === 'purchase' ? 'Harga jual' : 'Harga sewa'}</p><p className="m-0 text-2xl font-bold text-primary">{money(unitPrice)}{mode === 'rental' && <span className="ml-1 text-sm font-medium text-[#566274]">/ hari</span>}</p>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-canvas p-3 text-xs leading-relaxed text-[#566274]"><Info size={15} className="mt-0.5 shrink-0 text-primary" /><span>Stok katalog API untuk pilihan ini: {catalogStock} unit. Ketersediaan sewa dihitung server berdasarkan tanggal yang dipilih dan tetap divalidasi kembali saat booking.</span></div>
        </div>
        {mode === 'rental' && <div className="mb-5 rounded-xl border border-[#DDE2E9] bg-white p-4"><div className="mb-3 flex items-center gap-2"><CalendarDays size={17} className="text-primary" /><h2 className="m-0 text-sm font-semibold text-navy">Jadwal penyewaan</h2></div><div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1"><label className="text-xs font-semibold text-navy">Tanggal mulai<input type="date" min={localDate(new Date())} value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#DDE2E9] px-3 text-sm font-normal focus:border-primary focus:outline-none" /></label><label className="text-xs font-semibold text-navy">Tanggal kembali<input type="date" min={startDate || localDate(new Date())} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#DDE2E9] px-3 text-sm font-normal focus:border-primary focus:outline-none" /></label></div>{days > 0 && <p className="mb-0 mt-3 text-xs text-[#566274]">Durasi {days} hari · subtotal <b className="text-primary">{money(unitPrice * days * quantity)}</b></p>}</div>}
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[#DDE2E9] bg-white p-4"><div><p className="mb-1 text-xs font-semibold text-navy">Jumlah unit</p><p className="m-0 flex items-center gap-1 text-xs text-[#566274]"><CircleCheck size={14} className="text-primary" />{mode === 'rental' ? availabilityLoading ? 'Memeriksa ketersediaan...' : availabilityError ? 'Ketersediaan gagal dimuat' : `${available} unit tersedia untuk tanggal ini` : `${available} unit tersedia`}</p>{availabilityError && <p role="alert" className="mb-0 mt-1 text-xs text-red-700">{availabilityError}</p>}</div><div className="flex items-center gap-3"><button type="button" aria-label="Kurangi jumlah" className="grid size-9 place-items-center rounded-lg border border-[#DDE2E9]" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><input aria-label="Jumlah unit" type="number" min="1" max={Math.max(available, 1)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="w-12 text-center text-sm font-semibold text-navy outline-none" /><button type="button" aria-label="Tambah jumlah" disabled={quantity >= available || availabilityLoading} className="grid size-9 place-items-center rounded-lg border border-[#DDE2E9] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => setQuantity((value) => value + 1)}>+</button></div></div>
        <button type="button" disabled={!available || quantity > available || (mode === 'rental' && (days === 0 || availabilityLoading || Boolean(availabilityError)))} onClick={handleAdd} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-secondary transition hover:bg-secondary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"><ShoppingBag size={17} />{mode === 'purchase' ? 'Tambah ke keranjang' : 'Tambah booking sewa'}</button>
        {activeOrders > 0 && <p className="mb-0 mt-3 text-xs text-[#566274]">{activeOrders} pesanan/booking aktif di akun ini ikut diperhitungkan pada estimasi browser.</p>}
      </section>
    </div>
    {similar.length > 0 && <section className="mt-12 border-t border-[#DDE2E9] pt-8"><h2 className="mb-4 text-xl font-bold text-navy">Perlengkapan sejenis</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{similar.map((item) => <Link key={item.id} to={`/produk/${item.id}?jenis=${mode === 'rental' ? 'sewa' : 'jual'}`} className="flex items-center gap-3 rounded-xl border border-[#DDE2E9] bg-white p-3"><CustomerImage src={item.image} alt={item.imageAlt} className="size-16 shrink-0 rounded-lg" /><span><b className="block text-sm text-navy">{item.name}</b><small className="mt-1 block text-xs text-[#566274]">{item.category}</small></span></Link>)}</div></section>}
  </div>
}