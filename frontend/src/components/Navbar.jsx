import { Bell, CalendarDays } from 'lucide-react'

export default function Navbar({ page, onNotice }) {
  return <header className="sticky top-0 z-5 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-8 backdrop-blur-sm max-lg:px-5 max-md:h-14 max-md:px-3.5">
    <div className="text-sm font-semibold text-navy"><span className="font-normal text-slate-500">Arutala Adventure</span><span className="px-2 text-slate-300">/</span>{page}</div>
    <div className="flex items-center gap-4 text-xs text-slate-500 max-md:gap-2"><span className="flex items-center gap-2 max-md:hidden"><CalendarDays size={15} aria-hidden="true" />12 Agustus 2025</span><button className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-navy transition hover:border-orange-200 hover:bg-orange-50 hover:text-primary" aria-label="Notifikasi" onClick={onNotice}><Bell size={17} aria-hidden="true" /></button><span className="grid size-9 place-items-center rounded-full bg-navy text-xs font-semibold text-white">DP</span></div>
  </header>
}
