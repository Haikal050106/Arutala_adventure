import { useState } from 'react'
import { ArrowRight, LockKeyhole, Mail, Mountain } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../components/admin-auth-context'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { user, loading, login, sessionExpired } = useAdminAuth()
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

  return <main className="grid min-h-screen place-items-center bg-canvas px-4 py-8 sm:px-6 sm:py-12">
    <div className="grid w-full max-w-7xl overflow-hidden rounded-3xl border border-[#E5E5E5] bg-white shadow-[0_20px_70px_rgba(37,37,37,0.1)] lg:min-h-[650px] lg:grid-cols-[1.02fr_0.98fr]">
      <aside className="relative isolate flex min-h-[260px] flex-col justify-between overflow-hidden bg-secondary p-6 text-white sm:min-h-[320px] sm:p-9 lg:min-h-[650px] lg:p-12">
        <img className="absolute inset-0 -z-20 size-full object-cover" src="/selatan.jpg" alt="" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-secondary/95 via-secondary/55 to-secondary/20" />
        <Link to="/" className="inline-flex w-fit items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-lg" aria-label="Kembali ke website Arutala Adventure">
          <img src="/arutala-logo-transparent.png" alt="" className="size-11 object-contain" />
          <span className="pr-2"><b className="block text-sm font-bold text-secondary">Arutala Adventure</b><small className="text-[9px] font-semibold tracking-[0.14em] text-secondary/70">OUTDOOR &amp; TRAVEL</small></span>
        </Link>
        <div className="mt-10 max-w-lg sm:mt-16 lg:mb-5">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm"><Mountain size={14} aria-hidden="true" /> Area staf</span>
          <h1 className="mb-3 max-w-md text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Setiap perjalanan dimulai dari persiapan.</h1>
          <p className="mb-0 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">Kelola operasional Arutala Adventure dan bantu setiap petualang siap melangkah.</p>
        </div>
        <p className="mb-0 mt-8 hidden text-xs text-white/75 sm:block">Akses khusus untuk Admin dan Kasir.</p>
      </aside>
      <section className="flex items-center justify-center px-5 py-9 sm:px-10 sm:py-12 lg:px-14">
        <div className="w-full max-w-md">
      <div className="mb-7">
        <span className="mb-4 grid size-11 place-items-center rounded-xl bg-sand text-primary"><Mountain size={21} aria-hidden="true" /></span>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Portal Admin &amp; Kasir</p>
        <h1 className="m-0 text-2xl font-bold tracking-tight text-navy sm:text-3xl">Selamat datang kembali</h1>
        <p className="mb-0 mt-2 text-sm leading-relaxed text-secondary/70">Masuk dengan akun staf Arutala Adventure.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {sessionExpired && <p role="status" className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">Sesi staf telah berakhir. Silakan masuk kembali.</p>}
        <label className="block text-xs font-semibold text-navy">Email staf
          <span className="relative mt-1.5 block">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-[#E5E5E5] pl-10 pr-3 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25" placeholder="Masukkan email staf" />
          </span>
        </label>
        <label className="block text-xs font-semibold text-navy">Kata sandi
          <span className="relative mt-1.5 block">
            <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-[#E5E5E5] pl-10 pr-3 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25" placeholder="Kata sandi" />
          </span>
        </label>
        {error && <p role="alert" className="m-0 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-secondary disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy">{submitting ? 'Memeriksa akun...' : 'Masuk ke portal'}<ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></button>
      </form>

      <p className="mb-0 mt-6 text-center text-xs leading-relaxed text-secondary/60">Gunakan akun staf yang dibuat oleh Admin atau melalui tugas bootstrap backend.</p>
        </div>
      </section>
    </div>
  </main>
}
