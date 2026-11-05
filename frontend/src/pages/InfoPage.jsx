import { useState } from 'react'
import Card, { Heading } from '../components/Card'

export default function InfoPage({ title, description, columns, rows }) {
  const [search, setSearch] = useState('')
  const filteredRows = rows.filter((row) => row.join(' ').toLowerCase().includes(search.toLowerCase()))

  return <>
    <Heading title={title} description={description} />
    <Card className="overflow-hidden">
      <div className="flex min-h-22 items-center justify-between gap-4 px-5 max-sm:flex-col max-sm:items-start max-sm:py-4">
        <div><h2 className="m-0 text-sm font-semibold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-500">Informasi Arutala Adventure</p></div>
        <input className="h-10 w-full max-w-60 rounded-lg border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 max-sm:max-w-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari data..." />
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left whitespace-nowrap">
          <thead className="bg-canvas text-[10px] font-semibold uppercase tracking-wide text-slate-500"><tr>{columns.map((column) => <th className="h-11 border-y border-slate-200/80 px-4" key={column}>{column}</th>)}</tr></thead>
          <tbody>{filteredRows.map((row, rowIndex) => <tr className="border-b border-slate-100 text-xs text-slate-600 transition hover:bg-[#FAFBFC] last:border-0" key={`${row[0]}-${rowIndex}`}>{row.map((cell, index) => <td className="h-14 px-4" key={`${row[0]}-${index}`}>{index === 0 ? <b className="font-semibold text-navy">{cell}</b> : cell}</td>)}</tr>)}</tbody>
        </table>
        {!filteredRows.length && <p className="p-8 text-center text-sm text-slate-500">Data tidak ditemukan.</p>}
      </div>
    </Card>
  </>
}
