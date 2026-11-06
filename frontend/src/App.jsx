import { Link, Navigate, Outlet, Route, Routes, useLocation, useOutletContext } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import { AdminAuthProvider } from './components/AdminAuthContext'
import { useAdminAuth } from './components/admin-auth-context'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSectionPage from './pages/admin/AdminSectionPage'
import AdminPOSPage from './pages/admin/AdminPOSPage'
import AdminRentalsPage from './pages/admin/AdminRentalsPage'
import AdminPaymentHistoryPage from './pages/admin/AdminPaymentHistoryPage'
import { adminNavigation } from './data/admin-navigation'
import { AdminDemoProvider } from './components/AdminDemoStore'
function RequireStaff({ allowedRoles = ['admin', 'cashier'] }) {
  const location = useLocation()
  const outletContext = useOutletContext()
  const { user, loading } = useAdminAuth()

  if (loading) return <p className="p-8 text-center text-sm text-slate-600">Memeriksa sesi...</p>
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location }} />
  if (!allowedRoles.includes(user.role)) return <Navigate to="/admin/orders" replace />
  return <Outlet context={outletContext} />
}

function AdminNotFound() {
  return <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
    <h1 className="text-xl font-bold text-navy">Halaman Admin belum tersedia</h1>
    <p className="mt-2 text-sm text-slate-600">Halaman Admin yang diminta tidak tersedia.</p>
    <Link to="/admin" className="mt-4 inline-flex text-sm font-semibold text-secondary hover:underline">Kembali ke dashboard</Link>
  </section>
}

function AdminRoutes() {
  return <Routes>
    <Route path="login" element={<AdminLogin />} />
    <Route element={<RequireStaff />}>
      <Route element={<AdminDemoProvider><AdminLayout /></AdminDemoProvider>}>
        <Route element={<RequireStaff allowedRoles={['admin']} />}>
          <Route index element={<AdminDashboard />} />
          {adminNavigation.filter(({ path, key }) => path && ['products', 'categories', 'reports'].includes(key)).map((section) => <Route key={section.path} path={section.path} element={<AdminSectionPage section={section} />} />)}
        </Route>
        <Route path="pos" element={<AdminPOSPage />} />
        <Route path="payments" element={<AdminPaymentHistoryPage />} />
        <Route path="rentals" element={<AdminRentalsPage mode="history" />} />
        {adminNavigation.filter(({ path, key }) => path && ['orders', 'customers'].includes(key)).map((section) => <Route key={section.path} path={section.path} element={<AdminSectionPage section={section} />} />)}
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Route>
  </Routes>
}

export default function AdminApp() {
  return <AdminAuthProvider><AdminRoutes /></AdminAuthProvider>
}
