'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserPlus, Trash2, KeyRound, Copy, Check, ExternalLink, X, MessageCircle } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  isActive: boolean
  createdAt: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [resetModal, setResetModal] = useState<{ user: User; resetUrl: string; phone: string | null } | null>(null)
  const [generatingReset, setGeneratingReset] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u))
  }

  async function deleteUser(user: User) {
    if (!confirm(`Hapus user "${user.name}" secara permanen? Semua data terkait (project, issue, comment) juga akan dihapus.`)) return
    setDeleting(user.id)
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Gagal menghapus user')
    }
    setDeleting(null)
  }

  async function handleResetPassword(user: User) {
    setGeneratingReset(user.id)
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setResetModal({
          user,
          resetUrl: data.resetUrl,
          phone: data.phone,
        })
      } else {
        alert(data.error || 'Gagal membuat link reset password')
      }
    } catch (err) {
      alert('Terjadi kesalahan saat membuat link reset password')
    } finally {
      setGeneratingReset(null)
    }
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Users</h2>
        <Link href="/users/invite" className="btn-primary">
          <UserPlus size={16} />
          Invite User
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="font-medium">{user.name}</div>
                  {user.phone && <div className="text-xs text-[var(--text-muted)]">{user.phone}</div>}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{user.email}</td>
                <td>{user.role}</td>
                <td>
                  <span className="text-xs font-medium" style={{ color: user.isActive ? 'var(--green)' : 'var(--red)' }}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="text-right">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem', flexWrap: 'wrap' }}>

                    {/* Tombol Reset Password untuk Admin */}
                    <button
                      onClick={() => handleResetPassword(user)}
                      disabled={generatingReset === user.id}
                      className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                      title="Kirim / Buat Link Reset Password"
                    >
                      <KeyRound size={13} style={{ color: 'var(--accent)' }} />
                      <span>{generatingReset === user.id ? 'Generating...' : 'Reset Pass'}</span>
                    </button>

                    <button
                      onClick={() => toggleActive(user)}
                      className="btn-secondary text-xs py-1 px-2"
                      style={{ color: user.isActive ? 'var(--red)' : 'var(--green)' }}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>

                    <button
                      onClick={() => deleteUser(user)}
                      disabled={deleting === user.id}
                      className="btn-secondary text-xs py-1 px-2"
                      style={{ color: 'var(--red)' }}
                    >
                      <Trash2 size={13} />
                      {deleting === user.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Tampilan Link Reset Password */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div
            className="card w-full shadow-2xl relative"
            style={{
              maxWidth: 520,
              padding: '1.75rem',
              borderRadius: '1.25rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                    Link Reset Password
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                    Akun: <strong style={{ color: 'var(--text-secondary)' }}>{resetModal.user.name}</strong> ({resetModal.user.email})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setResetModal(null)}
                className="cursor-pointer"
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-muted)',
                  padding: '0.25rem',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Input & Copy Row */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
                Bagikan link berikut ke user:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="text"
                  readOnly
                  value={resetModal.resetUrl}
                  onClick={e => (e.target as HTMLInputElement).select()}
                  className="input select-all"
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    padding: '0.625rem 0.75rem',
                    backgroundColor: 'var(--bg-elevated)',
                    flex: 1,
                    minWidth: 0,
                    height: 'auto',
                    lineHeight: 'normal'
                  }}
                />
                <button
                  onClick={() => copyLink(resetModal.resetUrl)}
                  className="btn-primary"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.625rem 1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    flexShrink: 0,
                    cursor: 'pointer'
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* WhatsApp notification info */}
            {resetModal.phone && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.625rem',
                padding: '0.75rem 0.875rem',
                borderRadius: '0.75rem',
                backgroundColor: 'rgba(52, 199, 89, 0.08)',
                border: '1px solid rgba(52, 199, 89, 0.25)',
                marginBottom: '1.25rem'
              }}>
                <MessageCircle size={16} style={{ color: 'var(--green)', flexShrink: 0, marginTop: '0.125rem' }} />
                <p style={{ fontSize: '0.75rem', color: '#15803D', lineHeight: 1.5, margin: 0 }}>
                  Link reset password juga otomatis dikirimkan ke WhatsApp <strong style={{ color: '#166534' }}>{resetModal.phone}</strong>.
                </p>
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setResetModal(null)}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.5rem 1.25rem', cursor: 'pointer' }}
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
