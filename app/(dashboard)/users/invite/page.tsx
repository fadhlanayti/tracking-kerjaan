'use client'
import { useState } from 'react'
import { UserPlus, Copy, Check, Link2 } from 'lucide-react'

export default function InviteUserPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('CLIENT')
  const [inviteUrl, setInviteUrl] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setInviteUrl(''); setSubmitting(true)
    const res = await fetch('/api/invite/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, phone: phone || undefined, role }),
    })
    const data = await res.json()
    if (res.ok) { setInviteUrl(data.inviteUrl); setEmail(''); setName(''); setPhone('') }
    else setError(data.error || 'Failed to generate invite')
    setSubmitting(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: '30rem', margin: '0 auto', width: '100%' }}>
      {/* Page header */}
      <div className="flex items-center gap-3" style={{ marginBottom: '1.5rem' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
          <UserPlus size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Invite User</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Kirim undangan ke anggota tim baru</p>
        </div>
      </div>

      {/* Form card */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Name + Email row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="label">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="input" placeholder="John Doe" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input" placeholder="john@email.com" />
            </div>
          </div>

          {/* Phone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="label">No. WhatsApp</label>
            <input
              type="text" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="087218381744"
              className="input"
            />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Format bebas, otomatis dikonversi ke 62xxx</p>
          </div>

          {/* Role */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="label">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="input">
              <option value="CLIENT">Client</option>
              <option value="DEVELOPER">Developer</option>
            </select>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full" style={{ padding: '0.75rem 1rem', fontSize: '0.9375rem' }}>
            <UserPlus size={16} />
            {submitting ? 'Generating...' : 'Generate Invite Link'}
          </button>
        </form>
      </div>

      {/* Invite link result */}
      {inviteUrl && (
        <div className="card" style={{ marginTop: '1.25rem', padding: '1.25rem' }}>
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={15} style={{ color: 'var(--accent)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Invite Link</p>
          </div>

          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            wordBreak: 'break-all',
          }}>
            <p className="text-xs font-medium" style={{ color: 'var(--accent)', lineHeight: 1.6 }}>{inviteUrl}</p>
          </div>

          <button
            onClick={handleCopy}
            className="btn-primary w-full"
            style={{ marginTop: '1rem', padding: '0.625rem 1rem' }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      )}
    </div>
  )
}
