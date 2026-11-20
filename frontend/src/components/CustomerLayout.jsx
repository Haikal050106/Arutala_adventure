import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, MessageCircle, ShoppingBag, UserRound, X } from 'lucide-react'
import { useCustomerStore } from './useCustomerStore'
import CustomerFooter from './CustomerFooter'
import { CUSTOMER_WHATSAPP_URL } from '../lib/customer-contact'

const navClass = ({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isActive ? 'bg-[#FFF1EA] font-semibold text-primary' : 'font-medium text-secondary hover:text-primary'}`

export default function CustomerLayout() {
  const { cart, profile } = useCustomerStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const notify = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  return <div className="min-h-screen bg-white text-navy">
    <div className="bg-[#F7F7F7] px-4 py-2 text-center text-[11px] font-medium text-secondary">Katalog, pembelian, dan booking sewa terhubung ke server · Pembayaran dilakukan langsung di toko Arutala Adventure.</div>
    <header className="sticky top-0 z-30 border-b border-[#E5E5E5] bg-white">
      <div className="mx-auto flex h-19 max-w-7xl items-center justify-between gap-5 px-5 max-md:h-16 max-md:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Arutala Adventure beranda"><img src="/arutala-logo-transparent.png" alt="" className="size-10 object-contain" /><span><b className="block text-sm font-bold tracking-tight text-secondary">Arutala Adventure</b><small className="text-[9px] font-semibold tracking-[0.14em] text-secondary/70">OUTDOOR &amp; GEAR</small></span></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama"><NavLink to="/katalog" className={navClass}>Katalog</NavLink><NavLink to="/katalog?jenis=sewa" className={navClass}>Sewa alat</NavLink><NavLink to="/tentang" className={navClass}>Tentang</NavLink><NavLink to="/galeri" className={navClass}>Galeri</NavLink><NavLink to="/kontak" className={navClass}>Lokasi &amp; kontak</NavLink></nav>
        <div className="flex shrink-0 items-center gap-2"><a href={CUSTOMER_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hidden h-10 items-center gap-2 rounded-lg border border-primary px-3 text-xs font-semibold text-secondary transition-colors duration-200 hover:bg-[#FFF1EA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:inline-flex"><MessageCircle size={15} />WhatsApp</a><Link to="/keranjang" className="relative grid size-10 place-items-center rounded-lg border border-[#E5E5E5] text-secondary transition-colors duration-200 hover:border-primary hover:bg-[#FFF1EA] hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label={`Keranjang, ${cartCount} item`}><ShoppingBag size={18} />{cartCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">{cartCount}</span>}</Link><Link to={profile ? '/akun' : '/masuk'} className="hidden h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white transition-colors duration-200 hover:bg-[#E64F00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex"><UserRound size={15} />{profile ? 'Akun saya' : 'Masuk'}</Link><button type="button" className="grid size-10 place-items-center rounded-lg border border-[#E5E5E5] text-secondary transition-colors duration-200 hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button></div>
      </div>
      {menuOpen && <nav className="grid grid-cols-2 gap-1 border-t border-[#E5E5E5] px-4 py-3 lg:hidden" aria-label="Navigasi mobile"><NavLink onClick={() => setMenuOpen(false)} to="/katalog" className={navClass}>Katalog</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/katalog?jenis=sewa" className={navClass}>Sewa alat</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/tentang" className={navClass}>Tentang</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/galeri" className={navClass}>Galeri</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/kontak" className={navClass}>Lokasi &amp; kontak</NavLink><NavLink onClick={() => setMenuOpen(false)} to={profile ? '/akun' : '/masuk'} className={navClass}>{profile ? 'Akun' : 'Masuk'}</NavLink><a href={CUSTOMER_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className={`${navClass({ isActive: false })} inline-flex items-center gap-2`}><MessageCircle size={15} />WhatsApp</a></nav>}
    </header>
    <main className="min-h-[65vh]"><Outlet context={{ notify }} /></main>
    <CustomerFooter />
    {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-secondary px-5 py-3 text-sm font-medium text-white shadow-xl">{notice}</div>}
  </div>
}