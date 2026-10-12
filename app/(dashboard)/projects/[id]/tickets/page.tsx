'use client'
import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, X, Clock, ArrowLeft, Ticket, Trash2, RotateCcw } from 'lucide-react'
import Link from 'next/link'

interface TicketItem {
  id: string
  title: string
  description: string | null
  type: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION'
  pmNotes: string | null
  attachments: string[]
  createdAt: string
  createdBy: { id: string; name: string; role: string }
}

interface Member {
  user: { id: string }
  role: string
}

const TYPE_LABELS: Record<string, string> = {
  DEPLOY: '🚀 Deploy',
  FEATURE: '✨ Fitur Baru',
  BUGFIX: '🐛 Bugfix',
  OTHER: '📋 Lainnya',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:  { label: 'Menunggu',  color: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
  APPROVED: { label: 'Disetujui', color: '#065F46', bg: '#D1FAE5', border: '#6EE7B7' },
  REJECTED: { label: 'Ditolak',   color: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5' },
  REVISION: { label: 'Revisi',    color: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD' },
}

export default function TicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('')

  // Create form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('OTHER')
  const [submitting, setSubmitting] = useState(false)

  // PM review
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [pmNotes, setPmNotes] = useState('')
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED' | 'REVISION'>('APPROVED')

  // Detect PM role from project members
  const isPM = session?.user?.role === 'ADMIN' ||
    members.some(m => m.user.id === (session?.user as any)?.id && m.role === 'PM')

  // Only Developer/Client can create tickets — PM only reviews
  const canCreate = !isPM

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(data => { if (data?.members) setMembers(data.members) })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    const qs = filter ? `?status=${filter}` : ''
    fetch(`/api/projects/${id}/tickets${qs}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTickets(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id, filter])

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/projects/${id}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, type }),
    })
    if (res.ok) {
      const ticket = await res.json()
      setTickets(prev => [ticket, ...prev])
      setTitle('')
      setDescription('')
      setType('OTHER')
      setShowModal(false)
    }
    setSubmitting(false)
  }

  async function reviewTicket(ticketId: string) {
    const res = await fetch(`/api/projects/${id}/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: reviewStatus, pmNotes: pmNotes.trim() || null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTickets(prev => prev.map(t => t.id === ticketId ? updated : t))
      setReviewingId(null)
      setPmNotes('')
    }
  }

  async function deleteTicket(ticketId: string) {
    if (!confirm('Hapus ticket ini?')) return
    const res = await fetch(`/api/projects/${id}/tickets/${ticketId}`, { method: 'DELETE' })
    if (res.ok) setTickets(prev => prev.filter(t => t.id !== ticketId))
  }

  const isCreatorOrPM = (t: TicketItem) =>
    t.createdBy.id === (session?.user as any)?.id || isPM

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center gap-3">
          <Link href={`/projects/${id}`} style={{ color: 'var(--text-muted)', display: 'flex' }}>
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2.5">
            <div style={{
              width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
              backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Ticket size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)', margin: 0 }}>Tickets</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>Request & approval system</p>
            </div>
          </div>
        </div>
        {canCreate && (
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
            <Plus size={16} /> Buat Ticket
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: '1rem' }}>
        {['', 'PENDING', 'APPROVED', 'REJECTED', 'REVISION'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer transition-all"
            style={{
              backgroundColor: filter === s ? '#7C3AED' : 'var(--bg-card)',
              color: filter === s ? '#fff' : 'var(--text-muted)',
              borderColor: filter === s ? '#7C3AED' : 'var(--border)',
            }}
          >
            {s === '' ? 'Semua' : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      {/* Ticket List */}
      {tickets.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center" style={{ padding: '3rem 2rem', gap: '0.75rem' }}>
          <Ticket size={32} style={{ color: 'var(--border)' }} />
          <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Belum ada ticket</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Buat ticket untuk meminta persetujuan PM sebelum membuat issue baru.
          </p>
          {canCreate && (
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm" style={{ marginTop: '0.5rem' }}>
            <Plus size={14} /> Buat Ticket Pertama
          </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map(ticket => {
            const sc = STATUS_CONFIG[ticket.status]
            const isReviewing = reviewingId === ticket.id

            return (
              <div key={ticket.id} className="card" style={{ padding: '1.5rem 1.75rem' }}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '0.25rem' }}>
                      <span className="text-xs font-bold" style={{
                        backgroundColor: 'rgba(139,92,246,0.08)', color: '#7C3AED',
                        padding: '0.1rem 0.5rem', borderRadius: '0.375rem', border: '1px solid rgba(139,92,246,0.2)'
                      }}>
                        {TYPE_LABELS[ticket.type] || ticket.type}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                        backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`
                      }}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="font-bold text-base" style={{ color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
                      {ticket.title}
                    </p>
                    {ticket.description && (
                      <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        {ticket.description}
                      </p>
                    )}
                    <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '0.625rem' }}>
                      oleh <strong>{ticket.createdBy.name}</strong> · {new Date(ticket.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPM && ticket.status === 'PENDING' && (
                      <button
                        onClick={() => { setReviewingId(isReviewing ? null : ticket.id); setPmNotes(''); setReviewStatus('APPROVED') }}
                        className="btn-primary text-xs"
                        style={{ padding: '0.35rem 0.75rem' }}
                      >
                        Review
                      </button>
                    )}
                    {isCreatorOrPM(ticket) && (
                      <button
                        onClick={() => deleteTicket(ticket.id)}
                        className="inline-flex items-center justify-center p-1.5 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        style={{ background: 'none', border: 'none' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* PM Notes */}
                {ticket.pmNotes && !isReviewing && (
                  <div style={{
                    marginTop: '0.75rem', padding: '0.625rem 0.875rem',
                    borderRadius: '0.625rem', backgroundColor: sc.bg,
                    border: `1px solid ${sc.border}`
                  }}>
                    <p className="text-xs font-semibold" style={{ color: sc.color, marginBottom: '0.25rem' }}>Catatan PM:</p>
                    <p className="text-xs" style={{ color: sc.color }}>{ticket.pmNotes}</p>
                  </div>
                )}

                {/* Revision hint for creator */}
                {ticket.status === 'REVISION' && ticket.createdBy.id === (session?.user as any)?.id && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      onClick={() => setShowModal(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline cursor-pointer bg-transparent border-none p-0"
                    >
                      <RotateCcw size={12} /> Perbaiki dan submit ulang ticket baru
                    </button>
                  </div>
                )}

                {/* PM Review Panel */}
                {isReviewing && isPM && (
                  <div style={{
                    marginTop: '1rem', borderTop: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-elevated)',
                    borderRadius: '0 0 0.75rem 0.75rem',
                    margin: '1rem -1.75rem -1.5rem',
                    padding: '1.25rem 1.75rem 1.5rem'
                  }}>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      Review Ticket
                    </p>

                    <div className="flex gap-2 flex-wrap" style={{ marginBottom: '0.75rem' }}>
                      {(['APPROVED', 'REVISION', 'REJECTED'] as const).map(s => {
                        const c = STATUS_CONFIG[s]
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setReviewStatus(s)}
                            className="text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer transition-all"
                            style={{
                              backgroundColor: reviewStatus === s ? c.bg : 'var(--bg-card)',
                              color: reviewStatus === s ? c.color : 'var(--text-muted)',
                              borderColor: reviewStatus === s ? c.border : 'var(--border)',
                              fontWeight: reviewStatus === s ? 700 : 500,
                            }}
                          >
                            {c.label}
                          </button>
                        )
                      })}
                    </div>

                    <textarea
                      rows={2}
                      placeholder="Catatan untuk developer/client (opsional)..."
                      value={pmNotes}
                      onChange={e => setPmNotes(e.target.value)}
                      className="input text-xs resize-none w-full"
                      style={{ marginBottom: '0.75rem' }}
                    />

                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setReviewingId(null)} className="btn-secondary text-xs">
                        Batal
                      </button>
                      <button type="button" onClick={() => reviewTicket(ticket.id)} className="btn-primary text-xs">
                        Simpan Review
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="card w-full shadow-2xl" style={{ maxWidth: 600, padding: '2rem', borderRadius: '1.25rem' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem' }}>
              <div className="flex items-center gap-2.5">
                <div style={{
                  width: '2rem', height: '2rem', borderRadius: '0.625rem',
                  backgroundColor: 'rgba(139,92,246,0.1)', color: '#7C3AED',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Ticket size={15} />
                </div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Buat Ticket Baru</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="cursor-pointer border-none bg-transparent p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createTicket} className="flex flex-col gap-4">
              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Tipe Ticket</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setType(k)}
                      className="text-xs font-semibold py-2 px-3 rounded-xl border cursor-pointer transition-all text-left"
                      style={{
                        backgroundColor: type === k ? 'rgba(139,92,246,0.08)' : 'var(--bg-elevated)',
                        borderColor: type === k ? '#7C3AED' : 'var(--border)',
                        color: type === k ? '#7C3AED' : 'var(--text-muted)',
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Judul</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Deploy fitur login ke staging..."
                  className="input text-sm w-full"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Deskripsi <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span></label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Jelaskan perubahan yang diminta, environment target, dll..."
                  className="input text-sm resize-none w-full"
                />
              </div>

              <div className="flex justify-end gap-2" style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">
                  Batal
                </button>
                <button type="submit" disabled={submitting || !title.trim()} className="btn-primary text-xs">
                  {submitting ? 'Mengirim...' : 'Kirim Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
