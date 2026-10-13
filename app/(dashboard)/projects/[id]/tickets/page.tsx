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

const TYPE_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  DEPLOY:  { label: 'Deploy',    icon: '🚀', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  FEATURE: { label: 'Fitur Baru', icon: '✨', bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
  BUGFIX:  { label: 'Bugfix',    icon: '🐛', bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/20' },
  OTHER:   { label: 'Lainnya',   icon: '📋', bg: 'bg-zinc-500/10',    text: 'text-zinc-400',    border: 'border-zinc-500/20' },
}

const STATUS_THEME: Record<string, { label: string; dot: string; badge: string; text: string; icon: any }> = {
  PENDING:  { label: 'Menunggu Review', dot: 'bg-amber-400', badge: 'bg-amber-500/10 border-amber-500/30 text-amber-300', text: 'text-amber-400', icon: Clock },
  APPROVED: { label: 'Disetujui',       dot: 'bg-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300', text: 'text-emerald-400', icon: CheckCircle2 },
  REJECTED: { label: 'Ditolak',         dot: 'bg-rose-400', badge: 'bg-rose-500/10 border-rose-500/30 text-rose-300', text: 'text-rose-400', icon: XCircle },
  REVISION: { label: 'Perlu Revisi',    dot: 'bg-sky-400', badge: 'bg-sky-500/10 border-sky-500/30 text-sky-300', text: 'text-sky-400', icon: AlertTriangle },
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
    <div className="w-full max-w-5xl mx-auto pb-16 pt-2">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}`}
            className="w-9 h-9 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-black hover:border-zinc-300 flex items-center justify-center transition-all shadow-2xs"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-black m-0">Tickets</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-900 text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs text-zinc-500 m-0 mt-0.5">
              Antrean permintaan fitur, bugfix, dan persetujuan deployment oleh PM
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 transition-all shadow-sm cursor-pointer border-none"
          >
            <Plus size={15} />
            <span>Buat Ticket</span>
          </button>
        )}
      </div>

      {/* Filter Tabs Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-6 p-1.5 rounded-2xl bg-white/70 backdrop-blur-md border border-zinc-200/80 shadow-2xs flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto p-0.5">
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
                onClick={() => setFilter(tab.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border-none ${
                  active
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'bg-transparent text-zinc-600 hover:text-black hover:bg-zinc-100/80'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  active ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tickets Feed */}
      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200/80 text-zinc-400 flex items-center justify-center mb-3">
            <Ticket size={24} />
          </div>
          <p className="text-sm font-bold text-zinc-800 m-0">Belum ada ticket</p>
          <p className="text-xs text-zinc-500 m-0 mt-1 max-w-sm">
            {filter ? 'Tidak ada ticket dengan filter status ini.' : 'Buat ticket baru untuk meminta persetujuan perubahan atau deploy ke PM.'}
          </p>
          {canCreate && !filter && (
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer border-none"
            >
              <Plus size={14} /> Buat Ticket Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {tickets.map(ticket => {
            const statusMeta = STATUS_THEME[ticket.status] || STATUS_THEME.PENDING
            const StatusIcon = statusMeta.icon
            const typeMeta = TYPE_CONFIG[ticket.type] || TYPE_CONFIG.OTHER
            const isReviewing = reviewingId === ticket.id
            const isCreator = ticket.createdBy.id === (session?.user as any)?.id
            const isRevision = ticket.status === 'REVISION'

            // Format clean ticket code #TCK-XXXX
            const shortCode = ticket.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()

            return (
              <div
                key={ticket.id}
                className="group relative bg-white rounded-2xl border border-zinc-200/90 hover:border-zinc-300 p-4 sm:p-5 transition-all shadow-2xs hover:shadow-sm"
              >
                {/* Header row: ID tag, type pill, status badge, action buttons */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Clean Code Pill */}
                    <span className="font-mono text-[11px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md">
                      #{shortCode}
                    </span>

                    {/* Type badge */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md">
                      <span>{typeMeta.icon}</span>
                      <span>{typeMeta.label}</span>
                    </span>

                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                      <span>{statusMeta.label}</span>
                    </span>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-1.5">
                    {/* Tombol edit untuk creator jika revisi atau pending */}
                    {isCreator && (ticket.status === 'REVISION' || ticket.status === 'PENDING') && (
                      <button
                        onClick={() => openEditModal(ticket)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${
                          isRevision
                            ? 'bg-sky-500 text-white border-sky-600 shadow-xs hover:bg-sky-600'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                        title="Edit ticket ini langsung"
                      >
                        <Edit3 size={12} />
                        <span>{isRevision ? 'Perbaiki Ticket' : 'Edit'}</span>
                      </button>
                    )}

                    {/* Tombol PM Review */}
                    {isPMorAdmin && ticket.status === 'PENDING' && (
                      <button
                        onClick={() => {
                          setReviewingId(isReviewing ? null : ticket.id)
                          setPmNotes('')
                          setReviewStatus('APPROVED')
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white border-none cursor-pointer shadow-xs transition-all"
                      >
                        Review
                      </button>
                    )}

                    {/* Delete */}
                    {canDelete(ticket) && (
                      <button
                        onClick={() => deleteTicket(ticket.id)}
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border-none bg-transparent cursor-pointer p-0"
                        title="Hapus ticket"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Desc */}
                <h3 className="text-sm sm:text-base font-bold text-zinc-900 leading-snug m-0 mb-1">
                  {ticket.title}
                </h3>

                {ticket.description && (
                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed m-0 mb-3 whitespace-pre-wrap break-words">
                    {ticket.description}
                  </p>
                )}

                {/* Attachments preview */}
                {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap my-3 pt-1">
                    {(ticket.attachments as string[]).map((url, i) => {
                      const isImg = /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(url)
                      if (isImg) {
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openImage(url)}
                            className="inline-flex items-center gap-1.5 p-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs text-zinc-700 transition-colors cursor-pointer text-left"
                          >
                            <img src={url} alt={`attachment ${i+1}`} className="w-10 h-10 object-cover rounded-md border border-black/5" />
                            <span className="font-medium max-w-28 truncate text-[11px] pr-1.5">
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
                          <div className="w-8 h-8 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-blue-600">
                            <FileText size={16} />
                          </div>
                          <span className="font-medium max-w-28 truncate text-[11px] pr-1.5">
                            {url.split('/').pop() || `Lampiran ${i + 1}`}
                          </span>
                        </a>
                      )
                    })}
                  </div>
                )}

                {/* PM Notes Callout */}
                {ticket.pmNotes && (
                  <div className="my-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
                      <AlertTriangle size={13} />
                      <span>Catatan Project Manager:</span>
                    </div>
                    <p className="text-xs text-zinc-300 m-0 leading-relaxed whitespace-pre-wrap">
                      {ticket.pmNotes}
                    </p>
                  </div>
                )}

                {/* Meta info bottom */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span>Diajukan oleh:</span>
                    <strong className="text-zinc-700 font-semibold">{ticket.createdBy.name}</strong>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 font-mono">
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
                  <div className="mt-4 pt-4 border-t border-zinc-200 flex flex-col gap-3">
                    <p className="text-xs font-bold text-zinc-900 m-0">Keputusan Review PM:</p>
                    <div className="flex gap-2 flex-wrap">
                      {(['APPROVED', 'REVISION', 'REJECTED'] as const).map(s => {
                        const m = STATUS_THEME[s]
                        const isSel = reviewStatus === s
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setReviewStatus(s)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                              isSel ? `${m.badge} shadow-xs` : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-black'
                            }`}
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
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 outline-none focus:border-zinc-400 resize-none font-sans"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewingId(null)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-none cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewTicket(ticket.id)}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white border-none cursor-pointer shadow-xs"
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
