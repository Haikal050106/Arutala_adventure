import { Plus } from 'lucide-react'

export function Heading({ title, description, button, onClick }) {
  return <div className="mb-7 flex items-end justify-between gap-5 max-sm:mb-5 max-sm:items-start"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Arutala Adventure</p><h1 className="mb-1.5 font-[Manrope,sans-serif] text-2xl font-bold tracking-tight text-navy max-md:text-xl">{title}</h1><span className="text-sm text-slate-600 max-sm:text-xs">{description}</span></div>{button && <button className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E7650D] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy max-sm:px-3" onClick={onClick}><Plus size={16} aria-hidden="true" />{button}</button>}</div>
}

export default function Card({ children, className = '' }) {
  return <section className={`rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_12px_rgba(23,43,77,0.06)] ${className}`}>{children}</section>
}
