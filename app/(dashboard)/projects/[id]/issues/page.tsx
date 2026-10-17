'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Plus, MessageSquare, User, Filter, AlertCircle, ArrowUpRight, Trash2, Check, Users, Ticket } from 'lucide-react'
import { StatusBadge, statusLabels } from '@/components/status-badge'

interface Issue {
  id: string
  title: string
  status: string
  priority: string
  createdBy: { id: string; name: string }
  assignedTo: { id: string; name: string } | null
  assignees?: { user: { id: string; name: string } }[]
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
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([])
  const [members, setMembers] = useState<{ user: { id: string; name: string }; role: string }[]>([])

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(data => { if (data?.members) setMembers(data.members) })
      .catch(() => {})
  }, [id])

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
    const currentTitle = newTitle.trim()
    const currentDesc = newDesc.trim()
    const currentPriority = newPriority
    const tempId = `temp-${Date.now()}`

    // Optimistic
    const optimistic: Issue = {
      id: tempId,
      title: currentTitle,
      status: 'OPEN',
      priority: currentPriority,
      createdBy: { id: (session?.user as any)?.id || '', name: session?.user?.name || 'Saya' },
      assignedTo: null,
      assignees: selectedAssigneeIds.map(uid => ({
        user: { id: uid, name: members.find(m => m.user.id === uid)?.user.name || 'Developer' }
      })),
      _count: { comments: 0 },
      createdAt: new Date().toISOString(),
    }
    setIssues(prev => [optimistic, ...prev])
    setNewTitle('')
    setNewDesc('')
    const assigneeIdsToSend = [...selectedAssigneeIds]
    setSelectedAssigneeIds([])
    setShowCreateForm(false)

    try {
      const res = await fetch(`/api/projects/${id}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentTitle,
          description: currentDesc,
          priority: currentPriority,
          assigneeIds: assigneeIdsToSend,
        }),
      })
      if (res.ok) {
        const saved = await res.json()
        setIssues(prev => prev.map(i => i.id === tempId ? { ...saved, _count: saved._count || { comments: 0 } } : i))
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function quickUpdateStatus(issueId: string, status: string) {
    // Optimistic
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status } : i))
    try {
      await fetch(`/api/projects/${id}/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-sm text-black font-semibold">
        Memuat daftar issue...
      </div>
    )
  }

  // PM dan Admin: bisa buat issue, update status, hapus
  // Developer & Client: hanya lihat
  const isPMorAdmin = session?.user?.role === 'ADMIN' ||
    members.some(m => m.user.id === (session?.user as any)?.id && m.role === 'PM')
  const canCreate = isPMorAdmin
  const canUpdateStatus = isPMorAdmin
  const canDelete = isPMorAdmin

  async function deleteIssue(issueId: string) {
    if (!confirm('Hapus issue ini secara permanen?')) return
    // Optimistic
    setIssues(prev => prev.filter(i => i.id !== issueId))
    try {
      await fetch(`/api/projects/${id}/issues/${issueId}`, { method: 'DELETE' })
    } catch {}
  }

  return (
    <div style={{ width: '100%', maxWidth: 1024, margin: '0 auto', paddingTop: '0.75rem', paddingBottom: '4rem' }}>

      {/* Header bar dengan margin bawah yang lega */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--accent)' }}>
            Issues
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem', marginBottom: 0 }}>
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

          {/* Multi-Select Developer Assignees */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Users size={13} />
              <span>Assign Developer (Pilih satu atau lebih):</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {members
                .filter(m => m.role === 'DEVELOPER' || m.role === 'ADMIN' || m.role === 'PM')
                .map(m => {
                  const isChecked = selectedAssigneeIds.includes(m.user.id)
                  return (
                    <button
                      key={m.user.id}
                      type="button"
                      onClick={() => {
                        setSelectedAssigneeIds(prev =>
                          isChecked ? prev.filter(uid => uid !== m.user.id) : [...prev, m.user.id]
                        )
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: isChecked ? '1px solid #0071E3' : '1px solid var(--border)',
                        backgroundColor: isChecked ? 'rgba(0, 113, 227, 0.12)' : 'var(--bg-elevated)',
                        color: isChecked ? '#0071E3' : 'var(--text-secondary)',
                      }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isChecked ? '#0071E3' : 'rgba(0,0,0,0.1)',
                          color: '#fff',
                        }}
                      >
                        {isChecked && <Check size={8} />}
                      </div>
                      <span>{m.user.name}</span>
                    </button>
                  )
                })}
            </div>
          </div>

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

        <div className="flex items-center gap-3">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.5rem' }}>
            Total: <strong style={{ color: 'var(--text-primary)' }}>{issues.length}</strong> issue
          </div>

          {!isPMorAdmin && (
            <Link
              href={`/projects/${id}/tickets`}
              className="btn-primary text-xs"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.75rem',
              }}
            >
              <Ticket size={13} />
              <span>Buat Ticket</span>
            </Link>
          )}
        </div>
      </div>

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
                    {((issue.assignees && issue.assignees.length > 0) || issue.assignedTo) && (
                      <>
                        <span>•</span>
                        <span>
                          Ditugaskan ke:{' '}
                          <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {issue.assignees && issue.assignees.length > 0
                              ? issue.assignees.map(a => a.user.name).join(', ')
                              : issue.assignedTo?.name}
                          </strong>
                        </span>
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
