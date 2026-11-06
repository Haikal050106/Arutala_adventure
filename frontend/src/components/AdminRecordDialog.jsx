import { useState } from 'react'
import { X } from 'lucide-react'

const fieldClass = 'mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-navy outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25'
const labelClass = 'block text-xs font-semibold text-navy'

function Field({ label, children }) {
  return <label className={labelClass}>{label}{children}</label>
}

function TextInput({ value, onChange, ...props }) {
  return <input className={fieldClass} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} />
}

function SelectInput({ value, onChange, children, ...props }) {
  return <select className={fieldClass} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props}>{children}</select>
}

export default function AdminRecordDialog({ section, record, products, categories, customers, onClose, onSave }) {
  const [values, setValues] = useState(() => {
    if (section === 'rentals' && record) return { ...record, status: record.order.status, startDate: record.item.startDate, returnDate: record.item.returnDate, quantity: String(record.item.quantity) }
    if (record) return { ...record, quantity: String(record.quantity ?? '') }
    if (section === 'orders') return { quantity: '1', status: 'Menunggu konfirmasi', paymentStatus: 'Belum dibayar' }
    if (section === 'rentals') return { quantity: '1', status: 'Menunggu konfirmasi' }
    return {}
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const result = await onSave(values)
      if (result) setError(result)
      else onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Data gagal disimpan.')
    } finally {
      setSaving(false)
    }
  }
  const editing = Boolean(record)
  const heading = `${editing ? 'Ubah' : 'Tambah'} ${section === 'products' ? 'Produk' : section === 'categories' ? 'Kategori' : section === 'orders' ? 'Pesanan' : section === 'rentals' ? 'Penyewaan' : 'Pelanggan'}`

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="admin-record-title" className="my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
        <h2 id="admin-record-title" className="m-0 text-base font-bold text-navy">{heading}</h2>
        <button type="button" onClick={onClose} aria-label="Tutup form" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </header>
      <form onSubmit={submit} className="space-y-4 p-5">
        {section === 'products' && <>
          <Field label="Nama produk"><TextInput required maxLength={100} value={values.name} onChange={(value) => set('name', value)} /></Field>
          <Field label="Kategori"><SelectInput required value={values.category} onChange={(value) => set('category', value)}><option value="">Pilih kategori</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</SelectInput></Field>
          <Field label="Deskripsi"><textarea required maxLength={500} className={`${fieldClass} h-24 py-2`} value={values.description ?? ''} onChange={(event) => set('description', event.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Harga beli (Rp)"><TextInput required type="number" min="0" step="1000" value={values.salePrice} onChange={(value) => set('salePrice', value)} /></Field>
            <Field label="Harga sewa per hari (Rp)"><TextInput required type="number" min="0" step="1000" value={values.rentPricePerDay} onChange={(value) => set('rentPricePerDay', value)} /></Field>
            <Field label="Stok jual"><TextInput required type="number" min="0" step="1" value={values.saleStock} onChange={(value) => set('saleStock', value)} /></Field>
            <Field label="Stok sewa"><TextInput required type="number" min="0" step="1" value={values.rentalStock} onChange={(value) => set('rentalStock', value)} /></Field>
          </div>
          <Field label="URL gambar (opsional)"><TextInput type="url" value={values.image ?? ''} onChange={(value) => set('image', value)} /></Field>
        </>}
        {section === 'categories' && <>
          <Field label="Nama kategori"><TextInput required maxLength={60} value={values.name} onChange={(value) => set('name', value)} /></Field>
          <Field label="Deskripsi"><textarea required maxLength={250} className={`${fieldClass} h-24 py-2`} value={values.description ?? ''} onChange={(event) => set('description', event.target.value)} /></Field>
        </>}
        {section === 'customers' && <>
          <Field label="Nama pelanggan"><TextInput required maxLength={100} value={values.name} onChange={(value) => set('name', value)} /></Field>
          <Field label="Email"><TextInput required type="email" maxLength={150} value={values.email} onChange={(value) => set('email', value)} /></Field>
          <Field label="Nomor telepon"><TextInput required type="tel" minLength={8} maxLength={20} pattern="\+?[0-9][0-9\s()-]{6,18}[0-9]" value={values.phone} onChange={(value) => set('phone', value)} /></Field>
        </>}
        {section === 'orders' && <>
          {!editing && <>
            <Field label="Pelanggan"><SelectInput required value={values.customerId} onChange={(value) => set('customerId', value)}><option value="">Pilih pelanggan</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email}</option>)}</SelectInput></Field>
            <Field label="Produk"><SelectInput required value={values.productId} onChange={(value) => set('productId', value)}><option value="">Pilih produk</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field>
            <Field label="Jumlah"><TextInput required type="number" min="1" step="1" value={values.quantity || '1'} onChange={(value) => set('quantity', value)} /></Field>
          </>}
          <Field label="Status pesanan"><SelectInput required value={values.status ?? 'Menunggu konfirmasi'} onChange={(value) => set('status', value)}>{['Menunggu konfirmasi', 'Dikonfirmasi', 'Diproses', 'Selesai', 'Dibatalkan'].map((status) => <option key={status}>{status}</option>)}</SelectInput></Field>
          <Field label="Status pembayaran"><SelectInput required value={values.paymentStatus ?? 'Belum dibayar'} onChange={(value) => set('paymentStatus', value)}>{['Belum dibayar', 'Lunas', 'Tidak ada pembayaran'].map((status) => <option key={status}>{status}</option>)}</SelectInput></Field>
        </>}
        {section === 'rentals' && <>
          {!editing && <>
            <Field label="Pelanggan"><SelectInput required value={values.customerId} onChange={(value) => set('customerId', value)}><option value="">Pilih pelanggan</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email}</option>)}</SelectInput></Field>
            <Field label="Produk"><SelectInput required value={values.productId} onChange={(value) => set('productId', value)}><option value="">Pilih produk</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput></Field>
          </>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal mulai"><TextInput required type="date" value={values.startDate} onChange={(value) => set('startDate', value)} /></Field>
            <Field label="Tanggal kembali"><TextInput required type="date" value={values.returnDate} onChange={(value) => set('returnDate', value)} /></Field>
          </div>
          <Field label="Jumlah unit"><TextInput required type="number" min="1" step="1" value={values.quantity || '1'} onChange={(value) => set('quantity', value)} /></Field>
          <Field label="Status penyewaan"><SelectInput required value={values.status ?? 'Menunggu konfirmasi'} onChange={(value) => set('status', value)}>{['Menunggu konfirmasi', 'Dikonfirmasi', 'Diproses', 'Dikembalikan', 'Dibatalkan'].map((status) => <option key={status}>{status}</option>)}</SelectInput></Field>
        </>}
        {error && <p role="alert" className="m-0 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Batal</button>
          <button type="submit" disabled={saving} className="h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-secondary hover:bg-secondary hover:text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Simpan'}</button>
        </div>
      </form>
    </section>
  </div>
}
