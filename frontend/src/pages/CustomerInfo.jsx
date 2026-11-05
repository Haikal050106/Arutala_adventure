import { AtSign, Clock3, MapPin, Phone, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerImage from '../components/CustomerImage'
import { customerProducts } from '../data/customer-products'

export function AboutCustomerPage() {
  return <div className="mx-auto max-w-6xl px-5 py-12 max-md:px-4 max-md:py-8">
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Tentang Arutala</p>
        <h1 className="mb-4 text-3xl font-bold leading-tight text-navy max-sm:text-2xl">Teman persiapan sebelum melangkah ke alam.</h1>
        <p className="text-sm leading-relaxed text-[#566274]">Arutala Adventure melayani kebutuhan perlengkapan outdoor di wilayah Sikur, Lombok Timur. Pelanggan dapat melihat pilihan produk dan tarif sewa pada katalog prototipe ini.</p>
        <p className="text-sm leading-relaxed text-[#566274]">Konfirmasi stok, ukuran, dan jadwal tetap perlu dilakukan langsung dengan toko. Data situs ini belum terhubung ke inventori produksi.</p>
        <Link to="/katalog" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-white transition hover:bg-[#E7650D]">Lihat katalog</Link>
      </div>
      <CustomerImage
        src="https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=85"
        alt="Area persiapan perlengkapan petualangan"
        className="aspect-4/3 rounded-2xl border border-[#DDE2E9]"
      />
    </div>
    <div className="mt-10 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm leading-relaxed text-[#7D3B0E]">
      <div className="flex gap-2">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" />
        <p className="m-0"><b>Informasi prototipe:</b> harga dan ketersediaan yang ditampilkan merupakan data contoh. Pesanan online belum dikonfirmasi toko dan belum memproses pembayaran.</p>
      </div>
    </div>
  </div>
}

export function ContactCustomerPage() {
  return <div className="mx-auto max-w-6xl px-5 py-12 max-md:px-4 max-md:py-8">
    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Temukan kami</p>
    <h1 className="mb-2 text-3xl font-bold tracking-tight text-navy max-sm:text-2xl">Lokasi &amp; kontak</h1>
    <p className="mb-8 text-sm text-[#566274]">Hubungi toko untuk memeriksa ketersediaan aktual sebelum perjalanan.</p>
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-xl border border-[#DDE2E9] bg-white p-5">
        <h2 className="mb-4 text-base font-semibold text-navy">Arutala Adventure</h2>
        <p className="flex gap-3 text-sm leading-relaxed text-[#566274]"><MapPin size={17} className="mt-0.5 shrink-0 text-primary" />Dusun Gerami, Desa Gelora, Kecamatan Sikur, Lombok Timur</p>
        <p className="flex items-center gap-3 text-sm text-[#566274]"><Phone size={17} className="text-primary" />0853-3379-6838</p>
        <p className="flex items-center gap-3 text-sm text-[#566274]"><AtSign size={17} className="text-primary" />@arutala.adventure</p>
        <p className="flex items-center gap-3 text-sm text-[#566274]"><Clock3 size={17} className="text-primary" />08.00–22.00 · informasi contoh</p>
        <a href="tel:+6285333796838" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-semibold text-white transition hover:bg-[#263D62]">
          <Phone size={15} />Hubungi toko
        </a>
      </section>
      <div className="relative min-h-72 overflow-hidden rounded-xl border border-[#DDE2E9] bg-[#E9EDF2]">
        <CustomerImage
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85"
          alt="Pemandangan pegunungan di Lombok"
          className="absolute inset-0"
        />
        <div className="absolute inset-x-4 bottom-4 rounded-lg bg-white/95 p-4 shadow-lg">
          <p className="mb-1 text-xs font-semibold text-navy">Lokasi ilustrasi</p>
          <p className="mb-0 text-xs leading-relaxed text-[#566274]">Peta interaktif belum terhubung. Hubungi toko untuk petunjuk jalan dan konfirmasi alamat.</p>
        </div>
      </div>
    </div>
  </div>
}

export function CustomerGalleryPage() {
  return <div className="mx-auto max-w-7xl px-5 py-12 max-md:px-4 max-md:py-8">
    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Galeri Arutala</p>
    <h1 className="mb-2 text-3xl font-bold tracking-tight text-navy max-sm:text-2xl">Perlengkapan untuk cerita di alam terbuka</h1>
    <p className="mb-8 max-w-2xl text-sm leading-relaxed text-[#566274]">Lihat pilihan perlengkapan yang tersedia di katalog. Foto berikut adalah ilustrasi produk pada prototipe, bukan dokumentasi stok aktual.</p>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {customerProducts.map((product) => <article key={product.id} className="overflow-hidden rounded-xl border border-[#DDE2E9] bg-white shadow-[0_3px_14px_rgba(23,43,77,0.05)]">
        <CustomerImage src={product.image} alt={product.imageAlt} className="aspect-4/3" />
        <div className="flex items-center justify-between gap-3 p-4">
          <div>
            <h2 className="m-0 text-sm font-semibold text-navy">{product.name}</h2>
            <p className="mb-0 mt-1 text-xs text-[#566274]">{product.category}</p>
          </div>
          <Link to={`/produk/${product.id}`} className="shrink-0 text-xs font-semibold text-[#C94F08] hover:underline">Lihat produk</Link>
        </div>
      </article>)}
    </div>
  </div>
}
