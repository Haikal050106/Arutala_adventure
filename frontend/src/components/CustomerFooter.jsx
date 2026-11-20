import { Link } from 'react-router-dom'
import { MapPin, MessageCircle, Phone } from 'lucide-react'
import { CUSTOMER_WHATSAPP_NUMBER, CUSTOMER_WHATSAPP_URL } from '../lib/customer-contact'

export default function CustomerFooter() {
  return <footer className="mt-16 border-t border-[#E5E5E5] bg-white text-secondary">
    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_0.8fr_1fr] max-md:gap-8 max-md:px-4">
      <div><Link to="/" className="mb-3 inline-flex items-center gap-2.5"><img src="/arutala-logo-transparent.png" alt="" className="size-8 object-contain" /><b className="text-base">Arutala Adventure</b></Link><p className="max-w-sm text-sm leading-relaxed text-slate-600">Perlengkapan petualangan untuk menemani langkah dari jalur pertama hingga puncak berikutnya.</p></div>
      <div><h2 className="mb-3 text-sm font-semibold">Jelajahi</h2><div className="grid gap-2 text-sm text-slate-600"><Link to="/katalog" className="transition-colors hover:text-primary">Katalog produk</Link><Link to="/katalog?jenis=sewa" className="transition-colors hover:text-primary">Penyewaan alat</Link><Link to="/galeri" className="transition-colors hover:text-primary">Galeri</Link><Link to="/akun" className="transition-colors hover:text-primary">Pesanan saya</Link></div></div>
      <div><h2 className="mb-3 text-sm font-semibold">Kunjungi kami</h2><p className="flex gap-2 text-sm leading-relaxed text-slate-600"><MapPin size={16} className="mt-0.5 shrink-0 text-primary" />Dusun Gerami, Desa Gelora, Kecamatan Sikur, Lombok Timur</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Phone size={15} className="text-primary" />081931018896</p><a href={CUSTOMER_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-[#E64F00]"><MessageCircle size={15} />WhatsApp · +{CUSTOMER_WHATSAPP_NUMBER}</a></div>
    </div>
    <div className="border-t border-[#E5E5E5] px-5 py-4 text-center text-xs text-slate-500">© 2026 Arutala Adventure · Informasi dan transaksi online merupakan prototipe</div>
  </footer>
}