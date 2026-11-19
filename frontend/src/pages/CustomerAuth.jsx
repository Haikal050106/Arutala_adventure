import { useEffect, useRef, useState } from 'react'
import { ArrowRight, LockKeyhole, Mail, Mountain, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCustomerStore } from '../components/useCustomerStore'

export default function CustomerAuth() {
  const location = useLocation()
  const navigate = useNavigate()
  const { login, register } = useCustomerStore()
  const redirectTimer = useRef(null)
  const isRegister = location.pathname === '/daftar'
  const requestedNextPath = new URLSearchParams(location.search).get('next')
  const nextPath = requestedNextPath?.startsWith('/')
    && !requestedNextPath.startsWith('//')
    && !requestedNextPath.includes('\\')
    ? requestedNextPath
    : '/akun'
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', passwordConfirmation: '' })
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => () => window.clearTimeout(redirectTimer.current), [])

  useEffect(() => {
    setForm({ name: '', email: '', phone: '', password: '', passwordConfirmation: '' })
    setMessage('')
    setSuccess(false)
  }, [isRegister])

  const submit = async (event) => {
    event.preventDefault()
    if (success) return
    if (isRegister && form.password !== form.passwordConfirmation) {
      setMessage('Konfirmasi kata sandi tidak sama.')
      setSuccess(false)
      return
    }
    setBusy(true)
    setMessage('')
    setSuccess(false)
    try {
      if (isRegister) await register(form)
      else await login(form)
      setSuccess(true)
      setMessage(isRegister ? 'Akun berhasil dibuat. Mengalihkan ke akun Anda...' : 'Berhasil masuk. Mengalihkan ke akun Anda...')
      redirectTimer.current = window.setTimeout(() => navigate(nextPath), 700)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tidak dapat memproses permintaan. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
    <div className="grid overflow-hidden rounded-3xl border border-[#E5E5E5] bg-white shadow-[0_20px_70px_rgba(37,37,37,0.1)] lg:min-h-[650px] lg:grid-cols-[1.02fr_0.98fr]">
      <aside className="relative isolate flex min-h-[260px] flex-col justify-between overflow-hidden bg-secondary p-6 text-white sm:min-h-[320px] sm:p-9 lg:min-h-[650px] lg:p-12">
        <img className="absolute inset-0 -z-20 size-full object-cover" src="/selatan.jpg" alt="" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-secondary/95 via-secondary/55 to-secondary/20" />
        <Link to="/" className="inline-flex w-fit items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-lg" aria-label="Arutala Adventure beranda">
          <img src="/arutala-logo-transparent.png" alt="" className="size-11 object-contain" />
          <span className="pr-2"><b className="block text-sm font-bold text-secondary">Arutala Adventure</b><small className="text-[9px] font-semibold tracking-[0.14em] text-secondary/70">OUTDOOR &amp; GEAR</small></span>
        </Link>
        <div className="mt-10 max-w-lg sm:mt-16 lg:mb-5">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm"><Mountain size={14} /> Area pelanggan</span>
          <h1 className="mb-3 max-w-md text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">{isRegister ? 'Mulai langkah petualanganmu.' : 'Petualangan berikutnya menanti.'}</h1>
          <p className="mb-0 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">{isRegister ? 'Buat akun Arutala dan siapkan perlengkapan untuk perjalanan yang akan datang.' : 'Masuk untuk mengelola profil, memantau pesanan, dan merencanakan perjalanan berikutnya.'}</p>
        </div>
        <p className="mb-0 mt-8 hidden text-xs text-white/75 sm:block">Temukan perlengkapan untuk setiap perjalanan.</p>
      </aside>
      <section className="flex items-center justify-center px-5 py-9 sm:px-10 sm:py-12 lg:px-14">
        <div className="w-full max-w-md">
      <div className="mb-7"><div className="mb-4 grid size-11 place-items-center rounded-xl bg-sand text-primary"><UserRound size={20} /></div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{isRegister ? 'Bergabung bersama kami' : 'Akun Arutala'}</p><h2 className="mb-2 text-2xl font-bold text-navy sm:text-3xl">{isRegister ? 'Buat akun pelanggan' : 'Selamat datang kembali'}</h2><p className="m-0 text-sm leading-relaxed text-secondary/70">{isRegister ? 'Lengkapi data berikut untuk membuat akun.' : 'Masuk untuk melanjutkan perjalanan Anda bersama Arutala.'}</p></div>
      <form onSubmit={submit} autoComplete="off" className="space-y-4">
        {isRegister && <><label className="block text-xs font-semibold text-navy">Nama lengkap<input required autoComplete="off" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-[#DDE2E9] px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label><label className="block text-xs font-semibold text-navy">Nomor telepon<input required autoComplete="off" type="tel" value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-[#DDE2E9] px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label></>}
        <label className="block text-xs font-semibold text-navy">Email<span className="relative mt-1.5 block"><Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566274]" /><input required type="email" autoComplete={isRegister ? 'off' : 'email'} value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} className="h-11 w-full rounded-lg border border-[#DDE2E9] pl-10 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></span></label>
        <label className="block text-xs font-semibold text-navy">Kata sandi<span className="relative mt-1.5 block"><LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566274]" /><input required minLength={isRegister ? 12 : undefined} type="password" autoComplete={isRegister ? 'off' : 'current-password'} value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} className="h-11 w-full rounded-lg border border-[#DDE2E9] pl-10 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" placeholder={isRegister ? 'Minimal 12 karakter' : 'Kata sandi akun'} /></span></label>
        {isRegister && <label className="block text-xs font-semibold text-navy">Konfirmasi kata sandi<span className="relative mt-1.5 block"><LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566274]" /><input required minLength={12} type="password" autoComplete="off" value={form.passwordConfirmation} onChange={(event) => setForm((value) => ({ ...value, passwordConfirmation: event.target.value }))} className="h-11 w-full rounded-lg border border-[#DDE2E9] pl-10 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" placeholder="Ulangi kata sandi" /></span></label>}
        {message && <p role={success ? 'status' : 'alert'} className={`m-0 rounded-lg px-3 py-2 text-xs ${success ? 'bg-[#FFF1EA] text-[#C54300]' : 'bg-sand/40 text-secondary'}`}>{message}</p>}
        <button type="submit" disabled={busy || success} className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-secondary disabled:cursor-wait disabled:opacity-60">{busy ? 'Memproses...' : isRegister ? 'Buat akun' : 'Masuk ke akun'}<ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></button>
      </form>
      <p className="mb-0 mt-6 text-center text-sm text-secondary/70">{isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'} <Link to={`${isRegister ? '/masuk' : '/daftar'}${location.search}`} className="font-semibold text-primary hover:underline">{isRegister ? 'Masuk' : 'Daftar sekarang'}</Link></p>
        </div>
      </section>
    </div>
  </div>
}