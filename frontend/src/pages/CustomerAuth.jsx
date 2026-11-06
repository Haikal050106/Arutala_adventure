import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Compass, LockKeyhole, Mail, UserRound } from 'lucide-react'
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

  return <div className="mx-auto grid min-h-[620px] max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1fr_0.85fr] max-md:min-h-0 max-md:px-4 max-md:py-8">
    <div className="hidden overflow-hidden rounded-2xl bg-navy lg:block"><div className="relative min-h-[510px] p-8 text-white"><img className="absolute inset-0 size-full object-cover opacity-55" src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85" alt="" /><div className="absolute inset-0 bg-navy/50" /><div className="relative flex min-h-[446px] flex-col justify-between"><Compass size={30} className="text-primary" /><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sand">Arutala Adventure</p><h1 className="mb-3 text-4xl font-bold leading-tight">Lebih siap untuk cerita berikutnya.</h1><p className="max-w-sm text-sm leading-relaxed text-white/85">Masuk untuk mengelola profil dan melihat informasi akun pelanggan.</p></div><p className="mb-0 text-xs text-white/70">Sesi akun pelanggan diverifikasi oleh server.</p></div></div></div>
    <section className="mx-auto w-full max-w-md rounded-2xl border border-[#DDE2E9] bg-white p-7 shadow-[0_8px_32px_rgba(77,42,0,0.07)] max-sm:p-5">
      <div className="mb-6"><div className="mb-4 grid size-11 place-items-center rounded-xl bg-sand/40 text-primary"><UserRound size={20} /></div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Area pelanggan</p><h1 className="mb-2 text-2xl font-bold text-navy">{isRegister ? 'Buat akun pelanggan' : 'Masuk ke akun'}</h1><p className="m-0 text-sm leading-relaxed text-[#566274]">{isRegister ? 'Daftar untuk membuat akun pelanggan.' : 'Masuk menggunakan akun pelanggan Anda.'}</p></div>
      <form onSubmit={submit} autoComplete="off" className="space-y-4">
        {isRegister && <><label className="block text-xs font-semibold text-navy">Nama lengkap<input required autoComplete="off" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-[#DDE2E9] px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label><label className="block text-xs font-semibold text-navy">Nomor telepon<input required autoComplete="off" type="tel" value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-[#DDE2E9] px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></label></>}
        <label className="block text-xs font-semibold text-navy">Email<span className="relative mt-1.5 block"><Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566274]" /><input required type="email" autoComplete={isRegister ? 'off' : 'email'} value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} className="h-11 w-full rounded-lg border border-[#DDE2E9] pl-10 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" /></span></label>
        <label className="block text-xs font-semibold text-navy">Kata sandi<span className="relative mt-1.5 block"><LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566274]" /><input required minLength={isRegister ? 12 : undefined} type="password" autoComplete={isRegister ? 'off' : 'current-password'} value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} className="h-11 w-full rounded-lg border border-[#DDE2E9] pl-10 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" placeholder={isRegister ? 'Minimal 12 karakter' : 'Kata sandi akun'} /></span></label>
        {isRegister && <label className="block text-xs font-semibold text-navy">Konfirmasi kata sandi<span className="relative mt-1.5 block"><LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566274]" /><input required minLength={12} type="password" autoComplete="off" value={form.passwordConfirmation} onChange={(event) => setForm((value) => ({ ...value, passwordConfirmation: event.target.value }))} className="h-11 w-full rounded-lg border border-[#DDE2E9] pl-10 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" placeholder="Ulangi kata sandi" /></span></label>}
        {message && <p role={success ? 'status' : 'alert'} className={`m-0 rounded-lg px-3 py-2 text-xs ${success ? 'bg-[#F1F8F2] text-[#24683C]' : 'bg-sand/40 text-secondary'}`}>{message}</p>}
        <button type="submit" disabled={busy || success} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-secondary transition hover:bg-secondary hover:text-white disabled:opacity-60">{busy ? 'Memproses...' : isRegister ? 'Buat akun' : 'Masuk'}<ArrowRight size={16} /></button>
      </form>
      <p className="mb-0 mt-5 text-center text-sm text-[#566274]">{isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'} <Link to={`${isRegister ? '/masuk' : '/daftar'}${location.search}`} className="font-semibold text-secondary hover:underline">{isRegister ? 'Masuk' : 'Daftar'}</Link></p>
    </section>
  </div>
}