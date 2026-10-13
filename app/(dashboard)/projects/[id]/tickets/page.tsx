'use client'
import { useState, useEffect, use, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, X, ArrowLeft, Ticket, Trash2, RotateCcw, FileText, Paperclip, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useImageLightbox } from '@/components/image-lightbox'

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
  const { openImage } = useImageLightbox()
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
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB
  const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.pdf', '.zip', '.mp4', '.webm']

  function handlePickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    const files = e.target.files
    if (!files || files.length === 0) return

    const validFiles: { file: File; preview: string }[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validasi ukuran file (Max 15MB)
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`File "${file.name}" terlalu besar. Maksimal 15MB.`)
        continue
      }

      // Validasi ekstensi file
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_EXTS.includes(ext)) {
        setFileError(`Tipe file "${file.name}" tidak diizinkan. Format yang didukung: JPG, PNG, WEBP, PDF, ZIP, MP4.`)
        continue
      }

      validFiles.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
      })
    }

    if (validFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...validFiles])
    }
    if (e.target) e.target.value = ''
  }

  function removePendingFile(i: number) {
    setPendingFiles(prev => {
      URL.revokeObjectURL(prev[i].preview)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  // PM review
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [pmNotes, setPmNotes] = useState('')
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED' | 'REVISION'>('APPROVED')

  // Role detection — PM dan Admin punya hak sama
  const isPMorAdmin = session?.user?.role === 'ADMIN' ||
    members.some(m => m.user.id === (session?.user as any)?.id && m.role === 'PM')

  // PM/Admin tidak buat ticket, hanya review. Developer & Client bisa buat.
  const canCreate = !isPMorAdmin

  // PM/Admin bisa hapus semua. Creator bisa hapus milik sendiri.
  const canDelete = (t: TicketItem) =>
    isPMorAdmin || t.createdBy.id === (session?.user as any)?.id

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

    const currentTitle = title.trim()
    const currentDesc = description.trim()
    const currentType = type
    const currentFiles = [...pendingFiles]
    const tempId = `temp-${Date.now()}`

    // Optimistic: langsung tampil + tutup modal
    const optimistic: TicketItem = {
      id: tempId,
      title: currentTitle,
      description: currentDesc || null,
      type: currentType,
      status: 'PENDING',
      pmNotes: null,
      attachments: currentFiles.map(f => f.preview),
      createdAt: new Date().toISOString(),
      createdBy: {
        id: (session?.user as any)?.id || '',
        name: session?.user?.name || 'Saya',
        role: session?.user?.role || 'CLIENT',
      },
    }
    setTickets(prev => [optimistic, ...prev])
    setTitle('')
    setDescription('')
    setType('OTHER')
    setPendingFiles([])
    setShowModal(false)

    // Upload & simpan di background
    try {
      const uploadedUrls: string[] = []
      for (const { file } of currentFiles) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/upload', { method: 'POST', body: formData })
          const data = await res.json()
          if (data.url) uploadedUrls.push(data.url)
        } catch {}
      }

      const res = await fetch(`/api/projects/${id}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: currentTitle, description: currentDesc, type: currentType, attachments: uploadedUrls }),
      })
      if (res.ok) {
        const saved = await res.json()
        setTickets(prev => prev.map(t => t.id === tempId ? saved : t))
      }
      currentFiles.forEach(f => URL.revokeObjectURL(f.preview))
    } catch (err) {
      console.error(err)
    }
  }

  async function reviewTicket(ticketId: string) {
    const currentStatus = reviewStatus
    const currentNotes = pmNotes.trim() || null

    // Optimistic: langsung update UI + tutup panel
    setTickets(prev => prev.map(t => t.id === ticketId
      ? { ...t, status: currentStatus, pmNotes: currentNotes }
      : t
    ))
    setReviewingId(null)
    setPmNotes('')

    // Simpan ke server di background
    try {
      await fetch(`/api/projects/${id}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentStatus, pmNotes: currentNotes }),
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function deleteTicket(ticketId: string) {
    if (!confirm('Hapus ticket ini?')) return
    setTickets(prev => prev.filter(t => t.id !== ticketId))
    try {
      await fetch(`/api/projects/${id}/tickets/${ticketId}`, { method: 'DELETE' })
    } catch {}
  }

  const isCreatorOrPM = (t: TicketItem) => isPMorAdmin || t.createdBy.id === (session?.user as any)?.id

  if (loading) return <div className="loading-state !text-black font-semibold">Loading...</div>

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
              <h1 className="text-lg font-bold text-white" style={{  margin: 0 }}>Tickets</h1>
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
                    {isPMorAdmin && ticket.status === 'PENDING' && (
                      <button
                        onClick={() => { setReviewingId(isReviewing ? null : ticket.id); setPmNotes(''); setReviewStatus('APPROVED') }}
                        className="btn-primary text-xs"
                        style={{ padding: '0.35rem 0.75rem' }}
                      >
                        Review
                      </button>
                    )}
                    {canDelete(ticket) && (
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

                {/* Attachments */}
                {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap" style={{ marginTop: '0.75rem' }}>
                    {(ticket.attachments as string[]).map((url, i) => {
                      const isImg = /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(url)
                      if (isImg) {
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openImage(url)}
                            className="inline-flex items-center gap-1.5 p-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs text-zinc-700 transition-colors cursor-pointer text-left"
                          >
                            <img src={url} alt={`lampiran ${i + 1}`} className="w-10 h-10 object-cover rounded-md border border-black/5" />
                            <span className="font-medium max-w-28 truncate text-[11px]">
                              {url.split('/').pop() || `Lampiran ${i + 1}`}
                            </span>
                          </button>
                        )
                      }
                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 p-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs text-zinc-700 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-blue-600">
                            <FileText size={18} />
                          </div>
                          <span className="font-medium max-w-28 truncate text-[11px]">
                            {url.split('/').pop() || `Lampiran ${i + 1}`}
                          </span>
                        </a>
                      )
                    })}
                  </div>
                )}

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
                {isReviewing && isPMorAdmin && (
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label text-xs font-semibold block">
                    Lampiran Dokumen / File <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span>
                  </label>
                  <span className="text-[11px] text-zinc-400">Max 15MB/file (PDF, ZIP, Gambar)</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.pdf,.zip,.mp4,.webm"
                  className="hidden"
                  onChange={handlePickFiles}
                />

                {fileError && (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary text-xs"
                    style={{ padding: '0.4rem 0.75rem' }}
                  >
                    <Paperclip size={13} /> Pilih File / Lampiran
                  </button>

                  {pendingFiles.map((p, i) => (
                    <div key={i} className="relative group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-xs">
                      {p.preview ? (
                        <img src={p.preview} alt="" className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <FileText size={16} className="text-blue-600 shrink-0" />
                      )}
                      <span className="max-w-28 truncate text-[11px] font-medium text-zinc-700">
                        {p.file.name}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        ({(p.file.size / 1024 / 1024).toFixed(1)}MB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        className="text-zinc-400 hover:text-rose-600 transition-colors ml-1 cursor-pointer border-none bg-transparent p-0 flex items-center"
                        title="Hapus file"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
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
