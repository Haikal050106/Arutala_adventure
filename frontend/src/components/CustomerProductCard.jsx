import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, ShoppingBag } from 'lucide-react'
import { money } from '../lib/customer-shop'
import CustomerImage from './CustomerImage'

export default function CustomerProductCard({ product, mode = 'purchase' }) {
  const variantPrices = (product.variants || [])
    .map((variant) => mode === 'rental' ? variant.rentPricePerDay : variant.salePrice)
    .filter((value) => Number.isFinite(value) && value > 0)
  const price = variantPrices.length
    ? Math.min(...variantPrices)
    : mode === 'rental' ? product.rentPricePerDay : product.salePrice
  const priceLabel = (product.variants || []).length && price === 0 ? 'Harga dikonfirmasi toko' : `${money(price)}${mode === 'rental' ? ' / hari' : ''}`

  return <article className="group overflow-hidden rounded-xl border border-[#E5E5E5] bg-white shadow-[0_3px_14px_rgba(37,37,37,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(37,37,37,0.11)]">
    <Link to={`/produk/${product.id}?jenis=${mode === 'rental' ? 'sewa' : 'jual'}`} className="relative block aspect-4/3 overflow-hidden bg-[#E9EDF2]">
      <CustomerImage src={product.image} alt={product.imageAlt} className="size-full transition-transform duration-500 group-hover:scale-[1.04]" />
      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-navy shadow-sm">{product.category}</span>
      <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${mode === 'rental' ? 'bg-navy text-white' : 'bg-primary text-white'}`}>{mode === 'rental' ? 'Sewa' : 'Dijual'}</span>
    </Link>
    <div className="p-4">
      <Link to={`/produk/${product.id}?jenis=${mode === 'rental' ? 'sewa' : 'jual'}`} className="block min-h-11 text-sm font-semibold leading-snug text-navy hover:text-secondary">{product.name}</Link>
      <div className="mt-3 flex items-end justify-between gap-2"><div><p className="mb-1 text-[10px] font-medium text-[#566274]">{mode === 'rental' ? 'Tarif per hari' : 'Harga produk'}</p><p className="m-0 text-base font-bold text-primary">{priceLabel}</p></div><Link to={`/produk/${product.id}?jenis=${mode === 'rental' ? 'sewa' : 'jual'}`} className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#DDE2E9] text-navy transition group-hover:border-primary group-hover:bg-primary group-hover:text-white" aria-label={`${mode === 'rental' ? 'Sewa' : 'Lihat'} ${product.name}`}>{mode === 'rental' ? <CalendarDays size={16} /> : <ArrowUpRight size={17} />}</Link></div>
      <div className="mt-3 flex items-center justify-between border-t border-[#DDE2E9] pt-3 text-[11px] text-[#566274]"><span>{mode === 'rental' ? 'Unit untuk disewa' : 'Unit untuk dijual'}</span><span>{mode === 'rental' ? product.rentalStock : product.saleStock} unit · API</span></div>
      <Link to={`/produk/${product.id}?jenis=${mode === 'rental' ? 'sewa' : 'jual'}`} className="mt-3 flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#E5E5E5] text-xs font-semibold text-secondary transition hover:border-primary hover:bg-primary hover:text-white"><ShoppingBag size={14} />{mode === 'rental' ? 'Pilih jadwal sewa' : 'Lihat produk'}</Link>
    </div>
  </article>
}