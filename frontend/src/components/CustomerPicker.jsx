import { useMemo, useState } from 'react'
import { adminApiRequest, readAdminToken } from '../lib/admin-api'

const fieldClass = 'mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25'

export default function CustomerPicker({ customers, value, onChange }) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', village_name: '' })
  const filteredCustomers = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return customers
    return customers.filter((customer) => (
      `${customer.name} ${customer.phone || ''} ${customer.email || ''}`.toLowerCase().includes(search)
    ))
  }, [customers, query])
  const selectedCustomer = customers.find((customer) => String(customer.id) === String(value))
  const options = selectedCustomer && !filteredCustomers.some((customer) => customer.id === selectedCustomer.id)
    ? [selectedCustomer, ...filteredCustomers]
    : filteredCustomers

  const createCustomer = async (event) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const customer = await adminApiRequest('/customers', {
        method: 'POST',
        token: readAdminToken(),
        body: {
          customer: {
            name: newCustomer.name.trim(),
            phone: newCustomer.phone.trim() || null,
            village_name: newCustomer.village_name.trim() || null,
          },
        },
      })
      onChange(String(customer.id), customer)
      setQuery('')
      setNewCustomer({ name: '', phone: '', village_name: '' })
      setAdding(false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Pelanggan gagal disimpan.')
    } finally {
      setSaving(false)
    }
  }

  return <div>
    <label className="block text-xs font-semibold text-navy" htmlFor="customer-search">Cari pelanggan</label>
    <input
      id="customer-search"
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Nama atau nomor HP"
      className={fieldClass}
    />
    <label className="mt-3 block text-xs font-semibold text-navy" htmlFor="customer-select">Pilih pelanggan</label>
    <select
      id="customer-select"
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={fieldClass}
    >
      <option value="">Pilih pelanggan</option>
      {options.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customer.name}{customer.phone ? ` · ${customer.phone}` : customer.email ? ` · ${customer.email}` : ' · Offline'}
        </option>
      ))}
    </select>
    {!filteredCustomers.length && <p className="mb-0 mt-2 text-xs text-slate-500">Pelanggan tidak ditemukan.</p>}
    <button
      type="button"
      onClick={() => { setAdding((current) => !current); setError('') }}
      className="mt-2 text-xs font-semibold text-primary hover:underline"
    >
      {adding ? 'Tutup form' : '+ Tambah Pelanggan Baru'}
    </button>
    {adding && <form onSubmit={createCustomer} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs font-semibold text-navy">Nama pelanggan *
        <input required maxLength={100} value={newCustomer.name} onChange={(event) => setNewCustomer((current) => ({ ...current, name: event.target.value }))} className={fieldClass} />
      </label>
      <label className="block text-xs font-semibold text-navy">Nomor HP (opsional)
        <input type="tel" maxLength={20} value={newCustomer.phone} onChange={(event) => setNewCustomer((current) => ({ ...current, phone: event.target.value }))} className={fieldClass} />
      </label>
      <label className="block text-xs font-semibold text-navy">Alamat (opsional)
        <input maxLength={150} value={newCustomer.village_name} onChange={(event) => setNewCustomer((current) => ({ ...current, village_name: event.target.value }))} className={fieldClass} />
      </label>
      {error && <p role="alert" className="mb-0 text-xs text-red-700">{error}</p>}
      <button type="submit" disabled={saving} className="h-9 w-full rounded-lg bg-primary px-3 text-xs font-semibold text-secondary disabled:opacity-50">
        {saving ? 'Menyimpan...' : 'Simpan & pilih pelanggan'}
      </button>
    </form>}
  </div>
}
