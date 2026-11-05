import menus from '../data/menus'
import { BadgeDollarSign, Home, Images, MapPin, Package, Phone, ReceiptText, ShoppingCart, Store, Tags, UserRound } from 'lucide-react'

const menuIcons = {
  Dashboard: Home,
  UMKM: Store,
  Produk: Package,
  Kategori: Tags,
  Pemilik: UserRound,
  Lokasi: MapPin,
  Harga: BadgeDollarSign,
  Kontak: Phone,
  Galeri: Images,
  'Kasir (POS)': ShoppingCart,
  'Riwayat Transaksi': ReceiptText,
}

export default function Sidebar({ page, onNavigate }) {
  return <aside className="fixed inset-y-0 left-0 z-10 flex w-58.75 flex-col border-r border-slate-200/80 bg-white px-4 py-6 max-lg:w-51.25 max-md:static max-md:h-auto max-md:w-full max-md:border-r-0 max-md:border-b max-md:px-2 max-md:py-3">
    <div className="mb-9 flex items-center gap-3 px-1.5 max-md:mb-2.5"><img className="size-10.5 shrink-0 object-contain" src="/arutala-logo-transparent.png" alt="Logo Arutala Adventure" /><div><b className="block font-[Manrope,sans-serif] text-[15px] font-bold text-navy">Arutala Adventure</b><small className="mt-1 block text-[9px] font-medium tracking-[0.1em] text-slate-500">OUTDOOR &amp; GEAR</small></div></div>
    <p className="mb-2 ml-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 max-md:hidden">Menu</p>
    <nav className="min-h-0 flex-1 grid gap-1 overflow-y-auto pr-1 max-md:flex-none max-md:gap-1 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:pb-0.5">{menus.map(({ label }) => { const Icon = menuIcons[label]; return <button key={label} className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-left text-[13px] transition-colors max-md:h-9 max-md:flex-none max-md:gap-2 max-md:px-2.5 max-md:text-[11px] ${page === label ? 'bg-orange-50 font-semibold text-[#C94F08] before:absolute before:-left-4 before:h-5 before:w-1 before:rounded-r-full before:bg-primary max-md:before:hidden' : 'text-slate-600 hover:bg-slate-50 hover:text-navy'}`} onClick={() => onNavigate(label)}><Icon size={17} strokeWidth={1.8} aria-hidden="true" />{label}</button> })}</nav>
    <div className="mt-auto rounded-xl border border-orange-100 bg-orange-50/70 p-3.5 max-md:hidden"><p className="m-0 text-[11px] font-semibold text-navy">Siap untuk perjalanan berikutnya?</p><p className="mb-0 mt-1 text-[10px] leading-relaxed text-slate-600">Perlengkapan terawat, petualangan lebih nyaman.</p></div>
    <div className="mt-4 flex items-center gap-2.5 border-t border-slate-100 px-1 pt-4 max-md:hidden"><span className="grid size-9 place-items-center rounded-full bg-navy text-xs font-semibold text-white">DP</span><div><b className="block text-[11px] text-navy">Muh.Syarif Hidayatullah</b><small className="mt-1 block text-[10px] text-slate-500">Administrator</small></div></div>
  </aside>
}
