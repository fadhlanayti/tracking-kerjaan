'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Plus, MessageSquare, User, Filter, AlertCircle, ArrowUpRight, Trash2 } from 'lucide-react'
import { StatusBadge, statusLabels } from '@/components/status-badge'

interface Issue {
  id: string
  title: string
  status: string
  priority: string
  createdBy: { id: string; name: string }
  assignedTo: { id: string; name: string } | null
  _count: { comments: number }
  createdAt: string
}

const STATUSES = ['OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export default function IssuesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState('MEDIUM')
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  function fetchIssues() {
    const p = new URLSearchParams()
    if (statusFilter) p.set('status', statusFilter)
    if (priorityFilter) p.set('priority', priorityFilter)
    fetch(`/api/projects/${id}/issues?${p}`)
      .then(r => r.json())
      .then(data => { setIssues(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchIssues() }, [id, statusFilter, priorityFilter])

  async function createIssue(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await fetch(`/api/projects/${id}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, description: newDesc, priority: newPriority }),
    })
    if (res.ok) { setNewTitle(''); setNewDesc(''); setShowCreateForm(false); fetchIssues() }
    setCreating(false)
  }

  async function quickUpdateStatus(issueId: string, status: string) {
    setUpdatingId(issueId)
    await fetch(`/api/projects/${id}/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status } : i))
    setUpdatingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-sm text-[var(--text-muted)]">
        Memuat daftar issue...
      </div>
    )
  }

  const canCreate = session?.user?.role === 'ADMIN'
  const canUpdateStatus = session?.user?.role === 'ADMIN' || session?.user?.role === 'DEVELOPER'
  const canDelete = session?.user?.role === 'ADMIN'

  async function deleteIssue(issueId: string) {
    if (!confirm('Hapus issue ini secara permanen?')) return
    const res = await fetch(`/api/projects/${id}/issues/${issueId}`, { method: 'DELETE' })
    if (res.ok) setIssues(prev => prev.filter(i => i.id !== issueId))
  }

  return (
    <div style={{ width: '100%', maxWidth: 1024, margin: '0 auto', paddingTop: '0.75rem', paddingBottom: '4rem' }}>

      {/* Header bar dengan margin bawah yang lega */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
            Issues
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: 0 }}>
            Pantau, laporkan, dan kelola tugas serta kendala proyek
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer' }}
          >
            <Plus size={16} /> Tambah Issue
          </button>
        )}
      </div>

      {/* Create form drawer / card */}
      {showCreateForm && (
        <form onSubmit={createIssue} className="card p-5" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Buat Issue Baru</h3>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Batal
            </button>
          </div>

          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Judul issue"
            required
            className="input"
          />

          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Deskripsi detail kendala atau tugas (opsional)..."
            rows={3}
            className="input resize-none"
            style={{ fontSize: '0.8125rem', padding: '0.75rem' }}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Prioritas:</label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value)}
                className="input"
                style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.75rem', height: 'auto', lineHeight: 'normal' }}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{statusLabels[p] || p}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creating || !newTitle.trim()}
                className="btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
              >
                {creating ? 'Menyimpan...' : 'Simpan Issue'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter toolbar - Jarak lega ke atas dan bawah */}
      <div className="card p-3.5" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginRight: '0.25rem' }}>
            <Filter size={14} />
            <span>Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input text-xs"
            style={{ width: 'auto', padding: '0.45rem 0.85rem', height: 'auto', lineHeight: 'normal', cursor: 'pointer' }}
          >
            <option value="">Semua Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{statusLabels[s] || s}</option>)}
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="input text-xs"
            style={{ width: 'auto', padding: '0.45rem 0.85rem', height: 'auto', lineHeight: 'normal', cursor: 'pointer' }}
          >
            <option value="">Semua Prioritas</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{statusLabels[p] || p}</option>)}
          </select>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.5rem' }}>
          Total: <strong style={{ color: 'var(--text-primary)' }}>{issues.length}</strong> issue
        </div>
      </div>

      {/* Client info banner */}
      {session?.user?.role === 'CLIENT' && (
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', backgroundColor: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <p className="text-sm" style={{ color: '#7C3AED', margin: 0 }}>
            💡 Ingin melaporkan masalah? Buat <strong>Ticket</strong> terlebih dahulu untuk disetujui PM.
          </p>
          <Link href={`/projects/${id}/tickets`} className="btn-primary text-xs" style={{ flexShrink: 0, textDecoration: 'none' }}>
            Buat Ticket
          </Link>
        </div>
      )}

      {/* Issues list - Modern Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {issues.length === 0 ? (
          <div className="card p-12" style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <AlertCircle size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
            Belum ada issue yang cocok dengan filter.
          </div>
        ) : (
          issues.map(issue => (
            <div
              key={issue.id}
              className="card p-4.5"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'box-shadow 0.15s ease' }}
            >
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>

                {/* Left: Info */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Link
                    href={`/projects/${id}/issues/${issue.id}`}
                    style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)', textDecoration: 'none' }}
                  >
                    {issue.title}
                  </Link>

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.625rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <User size={12} />
                      {issue.createdBy.name}
                    </span>
                    {issue.assignedTo && (
                      <>
                        <span>•</span>
                        <span>Ditugaskan ke: <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{issue.assignedTo.name}</strong></span>
                      </>
                    )}
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent)', fontWeight: 500 }}>
                      <MessageSquare size={12} />
                      {issue._count.comments}
                    </span>
                    <span>•</span>
                    <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Right: Actions & Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <StatusBadge value={issue.priority} />

                  {canUpdateStatus ? (
                    <select
                      value={issue.status}
                      disabled={updatingId === issue.id}
                      onChange={e => quickUpdateStatus(issue.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="input text-xs font-semibold"
                      style={{ width: 'auto', padding: '0.4rem 0.75rem', height: 'auto', lineHeight: 'normal', cursor: 'pointer' }}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{statusLabels[s] || s}</option>)}
                    </select>
                  ) : (
                    <StatusBadge value={issue.status} />
                  )}

                  <Link
                    href={`/projects/${id}/issues/${issue.id}`}
                    className="btn-secondary text-xs"
                    style={{ padding: '0.4rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                  >
                    <span>Detail</span>
                    <ArrowUpRight size={13} />
                  </Link>

                  {canDelete && (
                    <button
                      onClick={() => deleteIssue(issue.id)}
                      className="inline-flex items-center justify-center p-1.5 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      style={{ background: 'none', border: 'none' }}
                      title="Hapus issue"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
