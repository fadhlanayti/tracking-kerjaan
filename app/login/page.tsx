'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email atau password salah.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-modal-frame">
        {/* Close Button top-right */}
        <Link href="/" className="auth-close-btn" aria-label="Close">
          <X size={16} />
        </Link>

        {/* Left Side: Form */}
        <div className="auth-col-form">
          {/* Header Brand */}
          <div>
            <div style={{
              border: '1.5px solid #27272A',
              borderRadius: '9999px',
              padding: '0.35rem 0.95rem',
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.45)'
            }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#18181B', letterSpacing: '-0.01em' }}>
                Weball
              </span>
            </div>
          </div>

          {/* Form Content */}
          <div style={{ maxWidth: '340px', width: '100%', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#18181B',
                letterSpacing: '-0.025em',
                margin: 0,
                lineHeight: 1.2
              }}>
                Masuk ke akun
              </h1>
              <p style={{
                fontSize: '0.8125rem',
                color: '#71717A',
                marginTop: '0.35rem',
                marginBottom: 0
              }}>
                Kelola projek dan update tim kamu
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#71717A', marginBottom: '0.25rem', paddingLeft: '0.75rem' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="nama@email.com"
                  className="auth-pill-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#71717A', marginBottom: '0.25rem', paddingLeft: '0.75rem' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
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
                disabled={loading}
                className="auth-pill-btn"
                style={{ marginTop: '0.25rem' }}
              >
                {loading ? 'Masuk...' : 'Masuk'}
              </button>
            </form>
          </div>

          {/* Footer note */}
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

        {/* Right Side: Visual Card */}
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
