'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { CheckCircle2, AlertCircle, ArrowLeft, X, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()

  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch(`/api/reset-password/${token}`)
      .then(async res => {
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Link reset password tidak valid')
        }
        return res.json()
      })
      .then(data => {
        setUserName(data.name)
        setUserEmail(data.email)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Password minimal 6 karakter'); return }
    if (password !== confirmPassword) { setError('Konfirmasi password tidak cocok'); return }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mereset password')

      setSuccess(true)

      if (userEmail) {
        const signInRes = await signIn('credentials', { email: userEmail, password, redirect: false })
        if (signInRes?.ok) { router.push('/dashboard'); router.refresh(); return }
      }

      router.push('/login')
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-modal-frame">
        <Link href="/login" className="auth-close-btn" aria-label="Close">
          <X size={16} />
        </Link>

        {/* Form Column */}
        <div className="auth-col-form">
          <div>
            <div style={{
              border: '1.5px solid #27272A',
              borderRadius: '9999px',
              padding: '0.35rem 0.95rem',
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.45)'
            }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#18181B' }}>
                Weball
              </span>
            </div>
          </div>

          <div style={{ maxWidth: '340px', width: '100%', margin: '0 auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#71717A', padding: '2rem 0' }}>
                Memeriksa link reset password...
              </div>
            ) : success ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center', padding: '2rem 0' }}>
                <CheckCircle2 size={48} style={{ color: '#10B981' }} />
                <div>
                  <h2 style={{ color: '#18181B', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                    Password Berhasil Diubah!
                  </h2>
                  <p style={{ color: '#71717A', fontSize: '0.8125rem', lineHeight: 1.6, margin: 0 }}>
                    Mengalihkan ke dashboard...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#18181B', margin: 0, lineHeight: 1.2 }}>
                    Reset Password
                  </h1>
                  <p style={{ fontSize: '0.8125rem', color: '#71717A', marginTop: '0.35rem', marginBottom: 0 }}>
                    {userName
                      ? <>Atur ulang password untuk <strong>{userName}</strong></>
                      : 'Buat password baru untuk akun Anda'}
                  </p>
                </div>

                {error && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#DC2626',
                    fontSize: '0.75rem',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '9999px',
                    marginBottom: '0.75rem'
                  }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#71717A', marginBottom: '0.25rem', paddingLeft: '0.75rem' }}>
                      Password Baru
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Minimal 6 karakter"
                        className="auth-pill-input"
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '0.85rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#9CA3AF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0
                        }}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#71717A', marginBottom: '0.25rem', paddingLeft: '0.75rem' }}>
                      Konfirmasi Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Ulangi password baru"
                      className="auth-pill-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="auth-pill-btn"
                    style={{ marginTop: '0.25rem' }}
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Password Baru'}
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                  <Link href="/login" style={{ fontSize: '0.75rem', color: '#71717A', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ArrowLeft size={12} /> Batal, kembali ke login
                  </Link>
                </div>
              </>
            )}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.6875rem',
            color: '#71717A'
          }}>
            <span>WeballCreative © 2026</span>
            <span style={{ color: '#52525B' }}>Project Tracker</span>
          </div>
        </div>

        {/* Visual Column */}
        <div className="auth-col-visual">
          <img
            src="/assets/auth/card-photo.png"
            alt="Team Collaboration"
            className="auth-visual-img"
          />
        </div>
      </div>
    </div>
  )
}
