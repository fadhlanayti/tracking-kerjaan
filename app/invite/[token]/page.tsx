'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [invite, setInvite] = useState<{ email: string; name: string } | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
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
      // Auto-login langsung dengan credentials
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

  if (loading) return <div className="loading-state min-h-screen">Loading...</div>
  if (error) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--red)' }}>{error}</div>

  return (
    <div className="auth-page">
      <div className="auth-card w-full">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            W
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Join WeballCreative</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Set up your account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={invite?.email || ''}
              disabled
              className="input"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            />
          </div>
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="input"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="input"
              placeholder="Min 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full justify-center py-2.5"
            style={{ marginTop: '1rem' }}
          >
            {submitting ? 'Setting up...' : 'Set Password & Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
