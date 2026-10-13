'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { X, Eye, EyeOff } from 'lucide-react'

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [invite, setInvite] = useState<{ email: string; name: string } | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setInvite(data)
          setName(data.name)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to validate invite')
        setLoading(false)
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const res = await fetch(`/api/invite/${token}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, name }),
    })
    const data = await res.json()

    if (data.success) {
      const signInRes = await signIn('credentials', {
        email: invite?.email,
        password,
        redirect: false,
      })

      if (signInRes?.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        router.push('/login')
      }
    } else {
      setError(data.error || 'Failed')
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
                Memvalidasi undangan...
              </div>
            ) : error && !invite ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <p style={{ color: '#DC2626', fontWeight: 500 }}>{error}</p>
                <Link href="/login" style={{ color: '#18181B', textDecoration: 'underline', fontSize: '0.8125rem', marginTop: '1rem', display: 'inline-block' }}>
                  Kembali ke Login
                </Link>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#18181B', margin: 0, lineHeight: 1.2 }}>
                    Bergabung ke Tim
                  </h1>
                  <p style={{ fontSize: '0.8125rem', color: '#71717A', marginTop: '0.35rem', marginBottom: 0 }}>
                    Atur nama dan password untuk mulai kerja
                  </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#71717A', marginBottom: '0.25rem', paddingLeft: '0.75rem' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={invite?.email || ''}
                      disabled
                      className="auth-pill-input"
                      style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#71717A', marginBottom: '0.25rem', paddingLeft: '0.75rem' }}>
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      className="auth-pill-input"
                    />
                  </div>

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

                  {error && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#DC2626',
                      fontSize: '0.75rem',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '9999px',
                      textAlign: 'center'
                    }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="auth-pill-btn"
                    style={{ marginTop: '0.25rem' }}
                  >
                    {submitting ? 'Menyiapkan akun...' : 'Set Password & Bergabung'}
                  </button>
                </form>
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
