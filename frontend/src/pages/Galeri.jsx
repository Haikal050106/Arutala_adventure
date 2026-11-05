import Card, { Heading } from '../components/Card'

const photos = [
  ['https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1000&q=85', 'Perlengkapan berkemah', 'Koleksi Arutala'],
  ['https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1000&q=85', 'Carrier pendakian', 'Produk pilihan'],
  ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=85', 'Pagi di pegunungan', 'Jalur pendakian'],
  ['https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1000&q=85', 'Siap menjelajah', 'Kegiatan komunitas'],
  ['https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1000&q=85', 'Camping bersama', 'Wisata alam'],
  ['https://images.unsplash.com/photo-1504851149312-7a075b496cc7?auto=format&fit=crop&w=1000&q=85', 'Keindahan alam', 'Tempat berkemah'],
]

export default function Galeri() {
  return <>
    <Heading title="Adventure In My Life" description="Perlengkapan dan suasana perjalanan Arutala." />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{photos.map(([image, title, caption]) => <Card className="group overflow-hidden" key={title}><div className="h-56 overflow-hidden bg-[#E9EDF2] max-sm:h-48"><img className="size-full object-cover transition-transform duration-500 group-hover:scale-105" src={image} alt={title} loading="lazy" /></div><div className="px-4 py-3.5"><b className="block text-sm font-semibold text-navy">{title}</b><small className="mt-1 block text-xs text-slate-500">{caption}</small></div></Card>)}</div>
  </>
}
