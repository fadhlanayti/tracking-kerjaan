'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Lock, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'

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
    if (password.length < 6) {
      setError('Password minimal 6 karakter')
      return
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mereset password')
      }

      setSuccess(true)

      // Auto-login langsung ke dashboard
      if (userEmail) {
        const signInRes = await signIn('credentials', {
          email: userEmail,
          password,
          redirect: false,
        })

        if (signInRes?.ok) {
          router.push('/dashboard')
          router.refresh()
          return
        }
      }

      router.push('/login')
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      backgroundColor: 'var(--bg-body)',
      boxSizing: 'border-box'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: 420,
        padding: '2.25rem',
        boxShadow: 'var(--shadow-md)',
        borderRadius: '1.25rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>

        {/* Header - Simetris di tengah */}
        <div style={{
          width: '3.25rem',
          height: '3.25rem',
          borderRadius: '1rem',
          backgroundColor: 'var(--accent-subtle)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem'
        }}>
          <Lock size={22} />
        </div>

        <h1 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          textAlign: 'center',
          margin: 0,
          letterSpacing: '-0.02em'
        }}>
          Reset Password
        </h1>

        {userName && (
          <p style={{
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: '0.375rem',
            marginBottom: '1.5rem'
          }}>
            Atur ulang password untuk <strong style={{ color: 'var(--text-primary)' }}>{userName}</strong>
          </p>
        )}

        {!userName && <div style={{ marginBottom: '1.5rem' }} />}

        {loading ? (
          <div style={{ padding: '2rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Memeriksa link reset password...
          </div>
        ) : success ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center', padding: '1rem 0' }}>
            <CheckCircle2 size={44} style={{ color: 'var(--green)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Password Berhasil Diubah!
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Password akun Anda telah berhasil diperbarui. Silakan login dengan password baru.
            </p>
            <div style={{ width: '100%', paddingTop: '0.75rem' }}>
              <Link href="/login" className="btn-primary" style={{ display: 'block', width: '100%', padding: '0.625rem', textAlign: 'center', fontSize: '0.8125rem', textDecoration: 'none' }}>
                Kembali ke Login
              </Link>
            </div>
          </div>
        ) : error ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center', padding: '1rem 0' }}>
            <AlertCircle size={44} style={{ color: 'var(--red)' }} />
            <p style={{ fontSize: '0.8125rem', color: 'var(--red)', fontWeight: 500, margin: 0 }}>
              {error}
            </p>
            <div style={{ width: '100%', paddingTop: '0.75rem' }}>
              <Link href="/login" className="btn-secondary" style={{ display: 'block', width: '100%', padding: '0.5rem', textAlign: 'center', fontSize: '0.8125rem', textDecoration: 'none' }}>
                Kembali ke Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label" style={{ fontSize: '0.75rem' }}>Password Baru</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                required
                className="input"
                style={{ fontSize: '0.8125rem', padding: '0.625rem 0.75rem' }}
              />
            </div>

            <div>
              <label className="label" style={{ fontSize: '0.75rem' }}>Konfirmasi Password Baru</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                required
                className="input"
                style={{ fontSize: '0.8125rem', padding: '0.625rem 0.75rem' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.6875rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                cursor: 'pointer'
              }}
            >
              {submitting ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>

            <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
              <Link href="/login" style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <ArrowLeft size={12} /> Batal dan kembali ke login
              </Link>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
