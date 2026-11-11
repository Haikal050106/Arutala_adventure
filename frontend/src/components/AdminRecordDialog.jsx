import { useEffect, useState } from 'react'
import { ImagePlus, Star, Trash2, Upload, X } from 'lucide-react'

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

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const PHOTO_MAX_BYTES = 10 * 1024 * 1024
const PHOTO_LIMIT = 10

function PhotoPreview({ file, src, alt }) {
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return <img src={previewUrl || src} alt={alt} className="size-full rounded-lg object-cover" />
}

export default function AdminRecordDialog({ section, record, products, categories, customers, onClose, onSave }) {
  const [values, setValues] = useState(() => {
    if (section === 'rentals' && record) return { ...record, status: record.order.status, startDate: record.item.startDate, returnDate: record.item.returnDate, quantity: String(record.item.quantity) }
    if (record) return {
      ...record,
      quantity: String(record.quantity ?? ''),
      newPhotos: [],
      photoReplacements: {},
      deletedPhotoIds: [],
      primaryPhotoKey: String(record.photos?.find((photo) => photo.is_primary)?.id ?? record.photos?.[0]?.id ?? ''),
    }
    if (section === 'orders') return { quantity: '1', status: 'Menunggu konfirmasi', paymentStatus: 'Belum dibayar' }
    if (section === 'rentals') return { quantity: '1', status: 'Menunggu konfirmasi' }
    if (section === 'products') return { newPhotos: [], photoReplacements: {}, deletedPhotoIds: [], primaryPhotoKey: '' }
    return {}
  })
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const result = await onSave(values)
      if (typeof result === 'string' && result) setError(result)
      else if (result?.error) {
        setValues((current) => ({
          ...current,
          photos: result.photos,
          newPhotos: [],
          photoReplacements: {},
          deletedPhotoIds: [],
          primaryPhotoKey: String(result.photos?.find((photo) => photo.is_primary)?.id ?? result.photos?.[0]?.id ?? ''),
        }))
        setError(result.error)
      }
      else onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Data gagal disimpan.')
    } finally {
      setSaving(false)
    }
  }
  const editing = Boolean(record)
  const heading = `${editing ? 'Ubah' : 'Tambah'} ${section === 'products' ? 'Produk' : section === 'categories' ? 'Kategori' : section === 'orders' ? 'Pesanan' : section === 'rentals' ? 'Penyewaan' : 'Pelanggan'}`
  const productPhotos = values.photos || []
  const newPhotos = values.newPhotos || []
  const deletedPhotoIds = values.deletedPhotoIds || []
  const activePhotoCount = productPhotos.filter((photo) => !deletedPhotoIds.includes(photo.id)).length + newPhotos.length
  const validatePhoto = (file) => {
    if (!PHOTO_TYPES.has(file.type)) return 'Foto harus berformat JPEG, PNG, atau WebP.'
    if (file.size > PHOTO_MAX_BYTES) return 'Ukuran setiap foto maksimal 10 MB.'
    return ''
  }
  const addPhotoFiles = (files) => {
    const incoming = Array.from(files)
    const invalid = incoming.map(validatePhoto).find(Boolean)
    if (invalid) {
      setPhotoError(invalid)
      return
    }
    if (activePhotoCount + incoming.length > PHOTO_LIMIT) {
      setPhotoError(`Maksimal ${PHOTO_LIMIT} foto untuk satu produk.`)
      return
    }
    setPhotoError('')
    setValues((current) => ({ ...current, newPhotos: [...(current.newPhotos || []), ...incoming] }))
  }
  const setPrimaryPhoto = (key) => set('primaryPhotoKey', key)

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
          <section aria-labelledby="product-photos-title" className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div><h3 id="product-photos-title" className="m-0 text-sm font-semibold text-navy">Foto produk</h3><p className="mb-0 mt-1 text-[11px] text-slate-500">JPEG, PNG, WebP · maksimal 10 MB per foto dan 10 foto per produk.</p></div>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-navy hover:border-primary">
                <ImagePlus size={15} aria-hidden="true" />Tambah foto
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { addPhotoFiles(event.target.files); event.target.value = '' }} />
              </label>
            </div>
            {productPhotos.map((photo) => {
              const isRemoved = deletedPhotoIds.includes(photo.id)
              const replacement = values.photoReplacements?.[photo.id]
              const photoKey = String(photo.id)
              return <div key={photo.id} className={`grid grid-cols-[4rem_1fr_auto] items-center gap-3 rounded-lg border p-2 ${isRemoved ? 'border-red-200 bg-red-50/50 opacity-70' : 'border-slate-100'}`}>
                <div className="size-16 overflow-hidden rounded-lg bg-slate-100"><PhotoPreview file={replacement} src={photo.secure_url} alt={photo.alt_text || values.name || 'Foto produk'} /></div>
                <div className="min-w-0">
                  <label className="flex items-center gap-2 text-xs font-medium text-navy">
                    <input type="radio" name="primary-product-photo" checked={values.primaryPhotoKey === photoKey} disabled={isRemoved} onChange={() => setPrimaryPhoto(photoKey)} />
                    <Star size={14} className={values.primaryPhotoKey === photoKey ? 'fill-primary text-primary' : 'text-slate-400'} aria-hidden="true" />
                    {isRemoved ? 'Akan dihapus saat disimpan' : values.primaryPhotoKey === photoKey ? 'Foto utama' : `Foto ${photo.position}`}
                  </label>
                  {replacement && <p className="mb-0 mt-1 truncate text-[10px] text-slate-500">Pengganti: {replacement.name}</p>}
                  {!isRemoved && <label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-secondary hover:underline">
                    <Upload size={12} aria-hidden="true" />Ganti foto
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
                      const file = event.target.files?.[0]
                      const invalid = file ? validatePhoto(file) : ''
                      setPhotoError(invalid)
                      if (file && !invalid) setValues((current) => ({ ...current, photoReplacements: { ...(current.photoReplacements || {}), [photo.id]: file } }))
                      event.target.value = ''
                    }} />
                  </label>}
                </div>
                <button type="button" className={`grid size-9 place-items-center rounded-lg ${isRemoved ? 'text-slate-500 hover:bg-slate-100' : 'text-red-500 hover:bg-red-50'}`} aria-label={isRemoved ? 'Batalkan hapus foto' : 'Hapus foto'} onClick={() => {
                  setValues((current) => {
                    const remove = !(current.deletedPhotoIds || []).includes(photo.id)
                    const deleted = remove ? [...(current.deletedPhotoIds || []), photo.id] : (current.deletedPhotoIds || []).filter((id) => id !== photo.id)
                    const remaining = (current.photos || []).filter((item) => !deleted.includes(item.id))
                    return {
                      ...current,
                      deletedPhotoIds: deleted,
                      primaryPhotoKey: remove && current.primaryPhotoKey === photoKey
                        ? String(remaining[0]?.id ?? (current.newPhotos?.length ? 'new-0' : ''))
                        : current.primaryPhotoKey,
                    }
                  })
                }}><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            })}
            {newPhotos.map((file, index) => {
              const photoKey = `new-${index}`
              return <div key={`${file.name}-${file.lastModified}-${index}`} className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 rounded-lg border border-dashed border-slate-300 p-2">
                <div className="size-16 overflow-hidden rounded-lg bg-slate-100"><PhotoPreview file={file} alt={`Pratinjau ${file.name}`} /></div>
                <div className="min-w-0">
                  <label className="flex items-center gap-2 text-xs font-medium text-navy">
                    <input type="radio" name="primary-product-photo" checked={values.primaryPhotoKey === photoKey} onChange={() => setPrimaryPhoto(photoKey)} />
                    <Star size={14} className={values.primaryPhotoKey === photoKey ? 'fill-primary text-primary' : 'text-slate-400'} aria-hidden="true" />
                    {values.primaryPhotoKey === photoKey ? 'Foto utama' : `Foto baru ${index + 1}`}
                  </label>
                  <p className="mb-0 mt-1 truncate text-[10px] text-slate-500">{file.name}</p>
                </div>
                <button type="button" className="grid size-9 place-items-center rounded-lg text-red-500 hover:bg-red-50" aria-label={`Hapus ${file.name}`} onClick={() => {
                  setValues((current) => {
                    const remaining = (current.newPhotos || []).filter((_, itemIndex) => itemIndex !== index)
                    const nextMainKey = current.primaryPhotoKey === photoKey
                      ? String(current.photos?.find((photo) => !current.deletedPhotoIds?.includes(photo.id))?.id ?? (remaining.length ? 'new-0' : ''))
                      : current.primaryPhotoKey?.startsWith('new-') && Number(current.primaryPhotoKey.slice(4)) > index
                        ? `new-${Number(current.primaryPhotoKey.slice(4)) - 1}`
                        : current.primaryPhotoKey
                    return { ...current, newPhotos: remaining, primaryPhotoKey: nextMainKey }
                  })
                }}><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            })}
            {productPhotos.length === 0 && newPhotos.length === 0 && <p className="mb-0 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Belum ada foto. Pilih beberapa foto untuk melihat pratinjau sebelum menyimpan.</p>}
            {photoError && <p role="alert" className="mb-0 text-xs text-red-700">{photoError}</p>}
          </section>
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
