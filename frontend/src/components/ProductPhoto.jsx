import { useState } from 'react'
import { PackageOpen } from 'lucide-react'

const photos = {
  Tenda: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1000&q=85',
  'Tas & Carrier': 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1000&q=85',
  'Alas Kaki': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=85',
  'Alat Masak': 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1000&q=85',
  Kenyamanan: 'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?auto=format&fit=crop&w=1000&q=85',
  Aksesori: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1000&q=85',
}

export default function ProductPhoto({ category, name, className = '' }) {
  const [failed, setFailed] = useState(false)
  const source = photos[category] || photos.Tenda

  return <div className={`overflow-hidden bg-[#E9EDF2] ${className}`}>
    {failed
      ? <div className="grid size-full place-items-center text-slate-400"><PackageOpen size={28} strokeWidth={1.5} aria-hidden="true" /></div>
      : <img className="size-full object-cover transition-transform duration-500 group-hover:scale-105" src={source} alt={`${name}, kategori ${category}`} loading="lazy" onError={() => setFailed(true)} />}
  </div>
}