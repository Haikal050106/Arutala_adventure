import { createElement } from 'react'
import { useEffect, useState } from 'react'
import { LogOut, Mountain, Store } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { adminNavigation } from '../data/admin-navigation'
import { useAdminDemoStore } from './useAdminDemoStore'
import { useAdminAuth } from './admin-auth-context'

export default function AdminLayout() {
  const navigate = useNavigate()
  const { user, logout: revokeSession } = useAdminAuth()
  const { storageError } = useAdminDemoStore()
  const [notice, setNotice] = useState(null)
  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])
  const notify = (message, type = 'success') => setNotice({ message, type })
  const logout = async () => {
    try {
      await revokeSession()
      navigate('/admin/login', { replace: true })
    } catch {
      setNotice({ message: 'Logout dari server gagal. Periksa koneksi lalu coba kembali.', type: 'error' })
    }
  }
  const visibleNavigation = user?.role === 'admin'
    ? adminNavigation
    : adminNavigation.filter(({ key }) => ['pos', 'payments', 'orders', 'rentals', 'customers'].includes(key))

  return <div className="min-h-screen bg-canvas text-navy md:flex">
    <aside className="flex border-b border-secondary/20 bg-secondary text-white md:fixed md:inset-y-0 md:left-0 md:w-64 md:flex-col md:border-b-0 md:border-r">
      <Link to="/admin" className="flex shrink-0 items-center gap-3 px-4 py-4 md:px-6 md:py-6" aria-label="Dashboard Admin Arutala">
        <img src="/arutala-logo-transparent.png" alt="" className="size-10 object-contain" />
        <span><b className="block text-sm font-bold text-white">Arutala Adventure</b><small className="text-[10px] font-medium uppercase tracking-wider text-white/70">{user?.role === 'cashier' ? 'Kasir' : 'Admin'}</small></span>
      </Link>
      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:items-stretch md:gap-1 md:overflow-visible md:px-3 md:py-2" aria-label="Navigasi Admin">
        {visibleNavigation.map(({ href, label, icon: Icon }) => <NavLink
          key={href}
          to={href}
          end={href === '/admin'}
          className={({ isActive }) => `flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${isActive ? 'bg-primary text-secondary' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
        >
          {createElement(Icon, { size: 17, 'aria-hidden': true })}{label}
        </NavLink>)}
      </nav>
      <div className="hidden border-t border-white/20 p-4 md:block">
        <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"><Store size={16} aria-hidden="true" />Lihat website</Link>
        <p className="mb-0 mt-3 flex items-center gap-2 px-3 text-[11px] text-white/65"><Mountain size={14} aria-hidden="true" />Produk, kategori, pelanggan & POS API</p>
      </div>
    </aside>

    <div className="min-w-0 flex-1 md:ml-64">
      <header className="flex h-16 items-center justify-between border-b border-secondary/20 bg-primary px-4 text-secondary sm:px-6 lg:px-8">
        <div>
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-white/75">Arutala Adventure</p>
          <p className="mb-0 mt-0.5 text-sm font-semibold text-white">Area {user?.role === 'cashier' ? 'Kasir' : 'Admin'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white sm:inline-flex">{user?.name} · {user?.role}</span>
          <button type="button" onClick={logout} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/40 px-3 text-xs font-semibold text-white transition hover:border-white hover:bg-white/10"><LogOut size={15} aria-hidden="true" />Keluar</button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        {storageError && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{storageError}</p>}
        <Outlet context={{ notify }} />
      </main>
    </div>
    {notice && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${notice.type === 'error' ? 'border-red-200 bg-white text-red-700' : 'border-emerald-200 bg-white text-emerald-800'}`}>{notice.message}</div>}
  </div>
}
