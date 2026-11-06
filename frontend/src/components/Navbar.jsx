import { Bell, CalendarDays } from 'lucide-react'

export default function Navbar({ page, onNotice }) {
  return <header className="sticky top-0 z-5 flex h-16 items-center justify-between border-b border-secondary/20 bg-primary px-8 text-secondary max-lg:px-5 max-md:h-14 max-md:px-3.5">
    <div className="text-sm font-semibold text-white"><span className="font-normal text-white/80">Arutala Adventure</span><span className="px-2 text-white/60">/</span>{page}</div>
    <div className="flex items-center gap-4 text-xs text-white/85 max-md:gap-2"><span className="flex items-center gap-2 max-md:hidden"><CalendarDays size={15} aria-hidden="true" />12 Agustus 2025</span><button className="grid size-9 place-items-center rounded-lg border border-white/40 bg-transparent text-white transition hover:border-white hover:bg-white/10" aria-label="Notifikasi" onClick={onNotice}><Bell size={17} aria-hidden="true" /></button><span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-semibold text-white">DP</span></div>
  </header>
}
