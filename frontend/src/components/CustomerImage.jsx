import { useEffect, useState } from 'react'
import { PackageOpen } from 'lucide-react'

export default function CustomerImage({ src, alt, className = '', loading = 'lazy' }) {
  const [failed, setFailed] = useState(!src)

  useEffect(() => {
    setFailed(!src)
  }, [src])

  return <div className={`overflow-hidden bg-[#E9EDF2] ${className}`}>
    {failed
      ? <div className="grid size-full min-h-20 place-items-center text-slate-400" role="img" aria-label={alt ? `${alt} tidak tersedia` : 'Gambar tidak tersedia'}><PackageOpen size={28} strokeWidth={1.5} aria-hidden="true" /></div>
      : <img src={src} alt={alt} loading={loading} className="size-full object-cover" onError={() => setFailed(true)} />}
  </div>
}
