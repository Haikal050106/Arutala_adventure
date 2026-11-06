import Card, { Heading } from '../components/Card'
import ProductPhoto from '../components/ProductPhoto'

const money = (value) => `Rp${Number(value).toLocaleString('id-ID')}`

export default function Harga({ products }) {
  return <>
    <Heading title="Harga perlengkapan" description="Bandingkan harga jual dan tarif sewa harian." />
    <Card className="overflow-hidden">
      <div className="flex min-h-22 items-center px-5"><div><h2 className="m-0 text-sm font-semibold text-navy">Daftar harga</h2><p className="mt-1 text-xs text-slate-500">Tarif sewa dihitung per hari</p></div></div>
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left whitespace-nowrap">
          <thead className="bg-canvas text-[10px] font-semibold uppercase tracking-wide text-slate-500"><tr>{['Produk', 'Harga jual', 'Harga sewa / hari'].map((column) => <th className="h-11 border-y border-slate-200/80 px-4" key={column}>{column}</th>)}</tr></thead>
          <tbody>{products.map((product) => <tr className="border-b border-slate-100 text-xs text-slate-600 transition hover:bg-[#FAFBFC] last:border-0" key={product.id}><td className="h-16 px-4"><div className="flex items-center gap-3"><ProductPhoto category={product.category} name={product.name} className="size-11 shrink-0 rounded-lg" /><div><b className="block font-semibold text-navy">{product.name}</b><small className="mt-1 block text-[11px] text-slate-500">{product.category}</small></div></div></td><td className="px-4 font-semibold text-navy">{money(product.sale)}</td><td className="px-4 font-semibold text-secondary">{money(product.rent)}</td></tr>)}</tbody>
        </table>
      </div>
    </Card>
  </>
}
