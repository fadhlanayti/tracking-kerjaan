'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FolderPlus, Users } from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  role: string
}

export default function NewProjectPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [repository, setRepository] = useState('')
  const [techStack, setTechStack] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedMembers, setSelectedMembers] = useState<{ userId: string; role: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data.filter((u: User) => u.role !== 'ADMIN')) })
      .catch(() => {})
  }, [])

  function toggleMember(userId: string, role: string) {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.userId === userId)
      if (exists) return prev.filter(m => m.userId !== userId)
      return [...prev, { userId, role }]
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        repository: repository || null,
        techStack: techStack || null,
        memberIds: selectedMembers,
      }),
    })

    if (res.ok) {
      const project = await res.json()
      router.push(`/projects/${project.id}`)
    } else {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 960, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <Link
              href="/dashboard"
              style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', textDecoration: 'none' }}
            >
              <ArrowLeft size={13} /> Dashboard
            </Link>
          </div>
          <h1 className='!text-white' style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FolderPlus size={24} />
            Buat Proyek Baru
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: 0 }}>
            Lengkapi nama proyek, deskripsi, dan pilih anggota tim yang terlibat
          </p>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="card p-6 sm:p-8" style={{ width: '100%' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sisi Kiri: Detail Proyek */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="label" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', display: 'block' }}>
                  Nama Proyek <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Website Redesign, Mobile App v2"
                  required
                  className="input"
                  style={{ fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', display: 'block' }}>
                  Deskripsi Proyek
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Jelaskan ruang lingkup proyek, target, atau catatan penting..."
                  rows={4}
                  className="input resize-none"
                  style={{ fontSize: '0.875rem', lineHeight: 1.5 }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', display: 'block' }}>
                    Repository URL
                  </label>
                  <input
                    type="url"
                    value={repository}
                    onChange={e => setRepository(e.target.value)}
                    placeholder="https://github.com/org/repo"
                    className="input"
                    style={{ fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label className="label" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', display: 'block' }}>
                    Tech Stack
                  </label>
                  <input
                    type="text"
                    value={techStack}
                    onChange={e => setTechStack(e.target.value)}
                    placeholder="e.g. Next.js, Flutter, Laravel"
                    className="input"
                    style={{ fontSize: '0.875rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Sisi Kanan: Pilih Anggota Tim */}
            <div>
              <label className="label" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Users size={15} style={{ color: 'var(--accent)' }} />
                <span>Tambahkan Anggota Tim</span>
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '0.75rem' }}>
                Pilih developer atau klien yang memiliki akses ke proyek ini
              </p>

              {users.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-xs)' }}>
                  Belum ada user anggota lain yang terdaftar.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '18rem', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {users.map(user => {
                    const selected = selectedMembers.some(m => m.userId === user.id)
                    return (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-sm transition-colors"
                        style={{
                          borderColor: selected ? 'var(--accent)' : 'var(--border)',
                          backgroundColor: selected ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleMember(user.id, user.role === 'DEVELOPER' ? 'DEVELOPER' : 'CLIENT')}
                          className="w-4 h-4"
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{user.name}</span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{user.email}</span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            backgroundColor: user.role === 'DEVELOPER' ? 'rgba(0,113,227,0.1)' : 'rgba(16,185,129,0.1)',
                            color: user.role === 'DEVELOPER' ? 'var(--accent)' : '#059669',
                          }}
                        >
                          {user.role}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer Bar: Aksi Batal & Simpan Justify Kiri-Kanan */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', marginTop: '0.5rem' }}>
            <Link
              href="/dashboard"
              className="btn-secondary"
              style={{ fontSize: '0.8125rem', padding: '0.55rem 1.25rem', textDecoration: 'none' }}
            >
              Batal
            </Link>

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn-primary"
              style={{ fontSize: '0.8125rem', padding: '0.55rem 1.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              {submitting ? 'Membuat Proyek...' : 'Buat Proyek'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
