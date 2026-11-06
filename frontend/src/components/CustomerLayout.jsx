import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Compass, Menu, ShoppingBag, UserRound, X } from 'lucide-react'
import { useCustomerStore } from './useCustomerStore'
import CustomerFooter from './CustomerFooter'

const navClass = ({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C46A1B] ${isActive ? 'bg-[#EBE3A7]/45 font-semibold text-[#C46A1B]' : 'font-medium text-secondary hover:text-[#C46A1B]'}`

export default function CustomerLayout() {
  const { cart, profile } = useCustomerStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const notify = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  return <div className="min-h-screen bg-canvas text-navy">
    <div className="bg-secondary px-4 py-2 text-center text-[11px] font-medium text-white">Katalog, pembelian, dan booking sewa terhubung ke server · Pembayaran dilakukan langsung di toko Arutala Adventure.</div>
    <header className="sticky top-0 z-30 border-b border-[#E8E1D5] bg-[#FAF7F0]">
      <div className="mx-auto flex h-19 max-w-7xl items-center justify-between gap-5 px-5 max-md:h-16 max-md:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Arutala Adventure beranda"><img src="/arutala-logo-transparent.png" alt="" className="size-10 object-contain" /><span><b className="block text-sm font-bold tracking-tight text-secondary">Arutala Adventure</b><small className="text-[9px] font-semibold tracking-[0.14em] text-secondary/70">OUTDOOR &amp; TRAVEL</small></span></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama"><NavLink to="/katalog" className={navClass}>Katalog</NavLink><NavLink to="/katalog?jenis=sewa" className={navClass}>Sewa alat</NavLink><NavLink to="/tentang" className={navClass}>Tentang</NavLink><NavLink to="/galeri" className={navClass}>Galeri</NavLink><NavLink to="/kontak" className={navClass}>Lokasi &amp; kontak</NavLink></nav>
        <div className="flex shrink-0 items-center gap-2"><Link to="/keranjang" className="relative grid size-10 place-items-center rounded-lg border border-[#D9D0C2] text-secondary transition-colors duration-200 hover:border-[#C46A1B] hover:bg-[#C46A1B]/5 hover:text-[#C46A1B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C46A1B]" aria-label={`Keranjang, ${cartCount} item`}><ShoppingBag size={18} />{cartCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[#C46A1B] px-1 text-[10px] font-bold text-white">{cartCount}</span>}</Link><Link to={profile ? '/akun' : '/masuk'} className="hidden h-10 items-center gap-2 rounded-lg bg-[#C46A1B] px-4 text-xs font-semibold text-white transition-colors duration-200 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C46A1B] lg:flex"><UserRound size={15} />{profile ? 'Akun saya' : 'Masuk'}</Link><button type="button" className="grid size-10 place-items-center rounded-lg border border-[#D9D0C2] text-secondary transition-colors duration-200 hover:border-[#C46A1B] hover:text-[#C46A1B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C46A1B] lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button></div>
      </div>
      {menuOpen && <nav className="grid grid-cols-2 gap-1 border-t border-[#E8E1D5] px-4 py-3 lg:hidden" aria-label="Navigasi mobile"><NavLink onClick={() => setMenuOpen(false)} to="/katalog" className={navClass}>Katalog</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/katalog?jenis=sewa" className={navClass}>Sewa alat</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/tentang" className={navClass}>Tentang</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/galeri" className={navClass}>Galeri</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/kontak" className={navClass}>Lokasi &amp; kontak</NavLink><NavLink onClick={() => setMenuOpen(false)} to={profile ? '/akun' : '/masuk'} className={navClass}>{profile ? 'Akun' : 'Masuk'}</NavLink></nav>}
    </header>
    <main className="min-h-[65vh]"><Outlet context={{ notify }} /></main>
    <CustomerFooter />
    {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-navy px-5 py-3 text-sm font-medium text-white shadow-xl">{notice}</div>}
  </div>
}