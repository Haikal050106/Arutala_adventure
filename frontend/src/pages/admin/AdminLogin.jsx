import { useState } from 'react'
import { Compass, LockKeyhole, Mail } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../components/admin-auth-context'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { user, loading, login } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <main className="grid min-h-screen place-items-center bg-canvas text-sm text-slate-600">Memeriksa sesi...</main>
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/admin/orders'} replace />

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const authenticatedUser = await login(email.trim(), password)
      navigate(authenticatedUser.role === 'admin' ? '/admin' : '/admin/orders', { replace: true })
    } catch (requestError) {
      setError(requestError.message || 'Login gagal. Periksa koneksi dan kredensial Anda.')
    } finally {
      setPassword('')
      setSubmitting(false)
    }
  }

  return <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_8px_32px_rgba(23,43,77,0.08)] max-sm:p-5">
      <Link to="/" className="mb-7 inline-flex items-center gap-3" aria-label="Kembali ke website Arutala Adventure">
        <img src="/arutala-logo-transparent.png" alt="" className="size-11 object-contain" />
        <span><b className="block text-sm font-bold text-navy">Arutala Adventure</b><small className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Admin</small></span>
      </Link>

      <div className="mb-6">
        <span className="mb-4 grid size-11 place-items-center rounded-xl bg-orange-50 text-primary"><Compass size={21} aria-hidden="true" /></span>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Login Admin</p>
        <h1 className="m-0 text-2xl font-bold tracking-tight text-navy text-center">Selamat datang</h1>
        <p className="mb-0 mt-2 text-sm leading-relaxed text-slate-600">Masuk dengan akun Admin atau Kasir Arutala Adventure.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-semibold text-navy">Email staf
          <span className="relative mt-1.5 block">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Masukan Email Kamu" />
          </span>
        </label>
        <label className="block text-xs font-semibold text-navy">Kata sandi
          <span className="relative mt-1.5 block">
            <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Kata sandi" />
          </span>
        </label>
        {error && <p role="alert" className="m-0 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-[#E7650D] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">{submitting ? 'Memeriksa akun...' : 'Masuk'}</button>
      </form>

      <p className="mb-0 mt-4 text-center text-[11px] leading-relaxed text-slate-500">Gunakan akun staf yang dibuat oleh Admin atau melalui tugas bootstrap backend.</p>
    </section>
  </main>
}
