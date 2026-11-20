import { useState } from 'react'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../components/admin-auth-context'
import { adminApiRequest, readAdminToken } from '../../lib/admin-api'

export default function AdminAccountPage() {
  const navigate = useNavigate()
  const { user, logout } = useAdminAuth()
  const [email, setEmail] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    const changingPassword = newPassword.length > 0 || passwordConfirmation.length > 0
    if (!currentPassword) {
      setError('Masukkan kata sandi saat ini untuk mengonfirmasi perubahan.')
      return
    }
    if (changingPassword && newPassword.length < 12) {
      setError('Kata sandi baru minimal 12 karakter.')
      return
    }
    if (changingPassword && newPassword !== passwordConfirmation) {
      setError('Konfirmasi kata sandi baru tidak sama.')
      return
    }

    setSubmitting(true)
    try {
      const payload = await adminApiRequest('/auth/account', {
        method: 'PATCH',
        token: readAdminToken(),
        body: {
          account: {
            email: email.trim(),
            current_password: currentPassword,
            ...(changingPassword ? {
              password: newPassword,
              password_confirmation: passwordConfirmation,
            } : {}),
          },
        },
      })
      setEmail(payload.user.email)
      if (payload.password_changed) {
        await logout()
        navigate('/admin/login', { replace: true, state: { accountUpdated: true } })
      } else {
        setSuccess('Email akun Admin berhasil diperbarui.')
      }
    } catch (requestError) {
      setError(requestError.message || 'Perubahan akun gagal disimpan.')
    } finally {
      setCurrentPassword('')
      setNewPassword('')
      setPasswordConfirmation('')
      setSubmitting(false)
    }
  }

  return <section className="mx-auto max-w-2xl">
    <div className="mb-6">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Keamanan akun</p>
      <h1 className="m-0 text-2xl font-bold tracking-tight text-navy">Akun Admin</h1>
      <p className="mb-0 mt-2 text-sm leading-relaxed text-slate-600">Perubahan hanya berlaku pada akun Admin yang sedang masuk. Konfirmasi dengan kata sandi saat ini.</p>
    </div>
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <label className="block text-xs font-semibold text-navy">Email Admin
        <span className="relative mt-1.5 block">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
        </span>
      </label>
      <div className="border-t border-slate-100 pt-4">
        <h2 className="mb-1 text-sm font-semibold text-navy">Ganti kata sandi</h2>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">Kosongkan kedua kolom kata sandi baru jika hanya ingin mengganti email. Kata sandi baru minimal 12 karakter.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-navy">Kata sandi baru
            <span className="relative mt-1.5 block">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
            </span>
          </label>
          <label className="block text-xs font-semibold text-navy">Konfirmasi kata sandi baru
            <span className="relative mt-1.5 block">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
            </span>
          </label>
        </div>
      </div>
      <label className="block border-t border-slate-100 pt-4 text-xs font-semibold text-navy">Kata sandi saat ini
        <span className="relative mt-1.5 block">
          <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
        </span>
      </label>
      {error && <p role="alert" className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</p>}
      {success && <p role="status" className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">{success}</p>}
      <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-[#E64F00] disabled:cursor-wait disabled:opacity-60">{submitting ? 'Menyimpan...' : 'Simpan perubahan'}</button>
    </form>
  </section>
}
