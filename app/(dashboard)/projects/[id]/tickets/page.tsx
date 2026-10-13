'use client'
import { useState, useEffect, use, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, X, ArrowLeft, Ticket, Trash2, Edit3, FileText, Paperclip, AlertCircle, Clock, CheckCircle2, XCircle, AlertTriangle, Layers, Send } from 'lucide-react'
import Link from 'next/link'
import { useImageLightbox } from '@/components/image-lightbox'
import { getSocket } from '@/lib/socket-client'

interface TicketItem {
  id: string
  title: string
  description: string | null
  type: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION'
  pmNotes: string | null
  attachments: string[]
  createdAt: string
  updatedAt?: string
  createdBy: { id: string; name: string; role: string; avatar?: string | null }
}

interface Member {
  user: { id: string }
  role: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  DEPLOY:  { label: 'Deploy',    icon: '🚀' },
  FEATURE: { label: 'Fitur Baru', icon: '✨' },
  BUGFIX:  { label: 'Bugfix',    icon: '🐛' },
  OTHER:   { label: 'Lainnya',   icon: '📋' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:  { label: 'Menunggu',    color: '#D97706', bg: '#FEF3C7' },
  APPROVED: { label: 'Disetujui',   color: '#15803D', bg: '#DCFCE7' },
  REVISION: { label: 'Perlu Revisi',color: '#0284C7', bg: '#E0F2FE' },
  REJECTED: { label: 'Ditolak',     color: '#DC2626', bg: '#FEE2E2' },
}

export default function TicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const { openImage } = useImageLightbox()
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTicket, setEditingTicket] = useState<TicketItem | null>(null)
  const [filter, setFilter] = useState('')

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('OTHER')
  const [submitting, setSubmitting] = useState(false)
  const [existingAttachments, setExistingAttachments] = useState<string[]>([])
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB
  const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.pdf', '.zip', '.mp4', '.webm']

  // PM Review Panel State
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [pmNotes, setPmNotes] = useState('')
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED' | 'REVISION'>('APPROVED')

  const isPMorAdmin = session?.user?.role === 'ADMIN' ||
    members.some(m => m.user.id === (session?.user as any)?.id && m.role === 'PM')

  const canCreate = !isPMorAdmin

  const canDelete = (t: TicketItem) =>
    isPMorAdmin || t.createdBy.id === (session?.user as any)?.id

  // 1. Fetch initial tickets & members
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

  // 2. Realtime WebSocket listener for live updates
  useEffect(() => {
    const socket = getSocket()
    socket.emit('join:project', { projectId: id })

    const handleTicketNew = (newTicket: TicketItem) => {
      setTickets(prev => {
        if (prev.some(t => t.id === newTicket.id)) return prev
        return [newTicket, ...prev]
      })
    }

    const handleTicketUpdated = (updatedTicket: TicketItem) => {
      setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t))
    }

    const handleTicketDeleted = ({ id: deletedId }: { id: string }) => {
      setTickets(prev => prev.filter(t => t.id !== deletedId))
    }

    socket.on('ticket:new', handleTicketNew)
    socket.on('ticket:updated', handleTicketUpdated)
    socket.on('ticket:deleted', handleTicketDeleted)

    return () => {
      socket.off('ticket:new', handleTicketNew)
      socket.off('ticket:updated', handleTicketUpdated)
      socket.off('ticket:deleted', handleTicketDeleted)
    }
  }, [id])

  function handlePickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    const files = e.target.files
    if (!files || files.length === 0) return

    const validFiles: { file: File; preview: string }[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`File "${file.name}" melebihi batas 15MB.`)
        continue
      }
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_EXTS.includes(ext)) {
        setFileError(`Tipe file "${file.name}" tidak didukung.`)
        continue
      }
      validFiles.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
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

  function openCreateModal() {
    setEditingTicket(null)
    setTitle('')
    setDescription('')
    setType('OTHER')
    setExistingAttachments([])
    setPendingFiles([])
    setFileError(null)
    setShowModal(true)
  }

  function openEditModal(t: TicketItem) {
    setEditingTicket(t)
    setTitle(t.title)
    setDescription(t.description || '')
    setType(t.type)
    setExistingAttachments(Array.isArray(t.attachments) ? t.attachments : [])
    setPendingFiles([])
    setFileError(null)
    setShowModal(true)
  }

  function closeModal() {
    pendingFiles.forEach(f => URL.revokeObjectURL(f.preview))
    setPendingFiles([])
    setEditingTicket(null)
    setShowModal(false)
  }

  async function handleSaveTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)

    try {
      // 1. Upload new files if any
      const newlyUploadedUrls: string[] = []
      for (const { file } of pendingFiles) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/upload', { method: 'POST', body: formData })
          const data = await res.json()
          if (data.url) newlyUploadedUrls.push(data.url)
        } catch {}
      }

      const finalAttachments = [...existingAttachments, ...newlyUploadedUrls]

      if (editingTicket) {
        // UPDATE TICKET YANG DIREVISI / PENDING
        const res = await fetch(`/api/projects/${id}/tickets/${editingTicket.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            type,
            attachments: finalAttachments,
          }),
        })
        if (res.ok) {
          const updated = await res.json()
          setTickets(prev => prev.map(t => t.id === editingTicket.id ? updated : t))
        }
      } else {
        // CREATE BARU
        const res = await fetch(`/api/projects/${id}/tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            type,
            attachments: finalAttachments,
          }),
        })
        if (res.ok) {
          const saved = await res.json()
          setTickets(prev => [saved, ...prev.filter(t => t.id !== saved.id)])
        }
      }

      closeModal()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function reviewTicket(ticketId: string) {
    const currentStatus = reviewStatus
    const currentNotes = pmNotes.trim() || null

    setTickets(prev => prev.map(t => t.id === ticketId
      ? { ...t, status: currentStatus, pmNotes: currentNotes }
      : t
    ))
    setReviewingId(null)
    setPmNotes('')

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
    if (!confirm('Hapus ticket ini secara permanen?')) return
    setTickets(prev => prev.filter(t => t.id !== ticketId))
    try {
      await fetch(`/api/projects/${id}/tickets/${ticketId}`, { method: 'DELETE' })
    } catch {}
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[40vh] text-sm text-black font-semibold">Memuat tickets...</div>
  }

  return (
    <div style={{ width: '100%', maxWidth: 1024, margin: '0 auto', paddingTop: '0.75rem', paddingBottom: '4rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href={`/projects/${id}`}
            className="btn-secondary"
            style={{ width: 36, height: 36, padding: 0, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 className="!text-black" style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: '#000000' }}>
                Tickets
              </h1>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, backgroundColor: 'rgba(0, 0, 0, 0.06)', color: 'var(--text-secondary)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10B981' }} />
                Live
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.375rem', marginBottom: 0 }}>
              Antrean permintaan fitur, bugfix, dan persetujuan deployment oleh PM
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={openCreateModal}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer' }}
          >
            <Plus size={16} /> Buat Ticket
          </button>
        )}
      </div>

      {/* Filter toolbar - Sesuai card filter Issues */}
      <div className="card p-3.5" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          {[
            { key: '', label: 'Semua', count: tickets.length },
            { key: 'PENDING', label: 'Menunggu', count: tickets.filter(t => t.status === 'PENDING').length },
            { key: 'REVISION', label: 'Perlu Revisi', count: tickets.filter(t => t.status === 'REVISION').length },
            { key: 'APPROVED', label: 'Disetujui', count: tickets.filter(t => t.status === 'APPROVED').length },
            { key: 'REJECTED', label: 'Ditolak', count: tickets.filter(t => t.status === 'REJECTED').length },
          ].map(tab => {
            const active = filter === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: active ? '1px solid #18181B' : '1px solid var(--border)',
                  backgroundColor: active ? '#18181B' : 'var(--bg-elevated)',
                  color: active ? '#FFFFFF' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    padding: '0.05rem 0.4rem',
                    borderRadius: '9999px',
                    backgroundColor: active ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.06)',
                    color: active ? '#FFFFFF' : 'var(--text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.5rem' }}>
          Total: <strong style={{ color: 'var(--text-primary)' }}>{tickets.length}</strong> ticket
        </div>
      </div>

      {/* Tickets Feed */}
      {tickets.length === 0 ? (
        <div className="card p-12" style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <AlertCircle size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Belum ada ticket</p>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
            {filter ? 'Tidak ada ticket dengan filter status ini.' : 'Buat ticket baru untuk meminta persetujuan perubahan atau deploy ke PM.'}
          </p>
          {canCreate && !filter && (
            <button
              onClick={openCreateModal}
              className="btn-primary"
              style={{ marginTop: '1rem', fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
            >
              <Plus size={14} /> Buat Ticket Pertama
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {tickets.map(ticket => {
            const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.PENDING
            const typeMeta = TYPE_CONFIG[ticket.type] || TYPE_CONFIG.OTHER
            const isReviewing = reviewingId === ticket.id
            const isCreator = ticket.createdBy.id === (session?.user as any)?.id
            const isRevision = ticket.status === 'REVISION'
            const shortCode = ticket.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()

            return (
              <div
                key={ticket.id}
                className="card p-4.5"
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'box-shadow 0.15s ease' }}
              >
                {/* Header Row: ID, Tipe, Status & Action */}
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* Ticket Code Tag */}
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                      }}
                    >
                      #{shortCode}
                    </span>

                    {/* Type Tag */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                      }}
                    >
                      <span>{typeMeta.icon}</span>
                      <span>{typeMeta.label}</span>
                    </span>

                    {/* Status Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        color: statusConfig.color,
                        backgroundColor: statusConfig.bg,
                      }}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Actions Right */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isCreator && (ticket.status === 'REVISION' || ticket.status === 'PENDING') && (
                      <button
                        onClick={() => openEditModal(ticket)}
                        className={isRevision ? 'btn-primary' : 'btn-secondary'}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.35rem 0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={13} />
                        <span>{isRevision ? 'Perbaiki Ticket' : 'Edit'}</span>
                      </button>
                    )}

                    {isPMorAdmin && ticket.status === 'PENDING' && (
                      <button
                        onClick={() => {
                          setReviewingId(isReviewing ? null : ticket.id)
                          setPmNotes('')
                          setReviewStatus('APPROVED')
                        }}
                        className="btn-primary"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.35rem 0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        Review PM
                      </button>
                    )}

                    {canDelete(ticket) && (
                      <button
                        onClick={() => deleteTicket(ticket.id)}
                        className="inline-flex items-center justify-center p-1.5 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        style={{ background: 'none', border: 'none' }}
                        title="Hapus ticket"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Desc */}
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>
                    {ticket.title}
                  </h3>
                  {ticket.description && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {ticket.description}
                    </p>
                  )}
                </div>

                {/* Attachments preview */}
                {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.25rem' }}>
                    {(ticket.attachments as string[]).map((url, i) => {
                      const isImg = /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(url)
                      if (isImg) {
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openImage(url)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              backgroundColor: 'var(--bg-elevated)',
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                            }}
                          >
                            <img src={url} alt={`attachment ${i+1}`} style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: '4px' }} />
                            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--bg-elevated)',
                            textDecoration: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                          }}
                        >
                          <FileText size={14} color="#0071E3" />
                          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {url.split('/').pop() || `Lampiran ${i + 1}`}
                          </span>
                        </a>
                      )
                    })}
                  </div>
                )}

                {/* PM Notes Callout - Soft clean alert banner matching dashboard */}
                {ticket.pmNotes && (
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 149, 0, 0.08)',
                      border: '1px solid rgba(255, 149, 0, 0.25)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: '#B45309', marginBottom: '0.25rem' }}>
                      <AlertTriangle size={13} />
                      <span>Catatan Project Manager:</span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {ticket.pmNotes}
                    </p>
                  </div>
                )}

                {/* Meta info bottom */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>Diajukan oleh:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{ticket.createdBy.name}</strong>
                    <span style={{ fontSize: '0.6875rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      {ticket.createdBy.role}
                    </span>
                  </div>
                  <span>
                    {new Date(ticket.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Inline PM Review Panel */}
                {isReviewing && isPMorAdmin && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Keputusan Review PM:</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(['APPROVED', 'REVISION', 'REJECTED'] as const).map(s => {
                        const m = STATUS_CONFIG[s]
                        const isSel = reviewStatus === s
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setReviewStatus(s)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: isSel ? `1px solid ${m.color}` : '1px solid var(--border)',
                              backgroundColor: isSel ? m.bg : 'var(--bg-elevated)',
                              color: isSel ? m.color : 'var(--text-secondary)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Tulis alasan atau instruksi revisi..."
                      value={pmNotes}
                      onChange={e => setPmNotes(e.target.value)}
                      className="input resize-none"
                      style={{ fontSize: '0.75rem', padding: '0.5rem' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setReviewingId(null)}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewTicket(ticket.id)}
                        className="btn-primary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}
                      >
                        Simpan Keputusan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Buat / Edit Ticket */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Ticket size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 m-0">
                    {editingTicket ? 'Perbarui Ticket Yang Direvisi' : 'Buat Ticket Baru'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 m-0">
                    {editingTicket ? `ID: #${editingTicket.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()} — Status akan otomatis kembali ke antrean Menunggu` : 'Ajukan permintaan untuk disetujui PM'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 flex items-center justify-center border-none bg-transparent cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTicket} className="flex flex-col gap-3.5">
              {/* Type Picker */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1.5">Tipe Permintaan</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_CONFIG).map(([k, meta]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setType(k)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border text-left cursor-pointer transition-all ${
                        type === k
                          ? 'bg-zinc-900 text-white border-zinc-950 shadow-xs'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Judul Ticket</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Contoh: Fix issue login expired di staging..."
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-zinc-200 outline-none focus:border-zinc-400 font-sans"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">
                  Deskripsi / Keterangan <span className="text-zinc-400 font-normal">(opsional)</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Jelaskan kebutuhan, perubahan branch, environment, atau konteks..."
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-zinc-200 outline-none focus:border-zinc-400 resize-none font-sans"
                />
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-700 block">Lampiran File (Max 15MB)</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-blue-600 hover:underline border-none bg-transparent cursor-pointer p-0"
                  >
                    + Tambah File
                  </button>
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
                  <p className="text-[11px] text-rose-600 m-0 mb-1.5 font-medium">{fileError}</p>
                )}

                {/* Existing files (if editing) */}
                {existingAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {existingAttachments.map((url, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-100 border border-zinc-200 text-[11px] text-zinc-700">
                        <span className="max-w-28 truncate">{url.split('/').pop() || `File ${i+1}`}</span>
                        <button
                          type="button"
                          onClick={() => setExistingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-zinc-400 hover:text-rose-600 border-none bg-transparent p-0 cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending files */}
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pendingFiles.map((p, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-800">
                        <span className="max-w-28 truncate">{p.file.name}</span>
                        <button
                          type="button"
                          onClick={() => removePendingFile(i)}
                          className="text-blue-400 hover:text-rose-600 border-none bg-transparent p-0 cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 mt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white border-none cursor-pointer shadow-xs disabled:opacity-50 transition-all"
                >
                  {submitting ? 'Menyimpan...' : editingTicket ? 'Simpan Pembaruan' : 'Kirim Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
