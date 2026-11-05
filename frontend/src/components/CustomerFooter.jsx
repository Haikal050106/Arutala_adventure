import { Link } from 'react-router-dom'
import { MapPin, Phone } from 'lucide-react'

export default function CustomerFooter() {
  return <footer className="mt-16 bg-navy text-white">
    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_0.8fr_1fr] max-md:gap-8 max-md:px-4">
      <div><Link to="/" className="mb-3 inline-flex items-center gap-2.5"><img src="/arutala-logo-transparent.png" alt="" className="size-8 object-contain" /><b className="text-base">Arutala Adventure</b></Link><p className="max-w-sm text-sm leading-relaxed text-slate-300">Perlengkapan petualangan untuk menemani langkah dari jalur pertama hingga puncak berikutnya.</p></div>
      <div><h2 className="mb-3 text-sm font-semibold">Jelajahi</h2><div className="grid gap-2 text-sm text-slate-300"><Link to="/katalog" className="hover:text-white">Katalog produk</Link><Link to="/katalog?jenis=sewa" className="hover:text-white">Penyewaan alat</Link><Link to="/galeri" className="hover:text-white">Galeri</Link><Link to="/akun" className="hover:text-white">Pesanan saya</Link></div></div>
      <div><h2 className="mb-3 text-sm font-semibold">Kunjungi kami</h2><p className="flex gap-2 text-sm leading-relaxed text-slate-300"><MapPin size={16} className="mt-0.5 shrink-0 text-primary" />Dusun Gerami, Desa Gelora, Kecamatan Sikur, Lombok Timur</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><Phone size={15} className="text-primary" />0853-3379-6838</p></div>
    </div>
    <div className="border-t border-white/10 px-5 py-4 text-center text-xs text-slate-400">© 2026 Arutala Adventure · Informasi dan transaksi online merupakan prototipe</div>
  </footer>
}