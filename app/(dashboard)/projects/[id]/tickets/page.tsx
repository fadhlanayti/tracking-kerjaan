'use client'
import { useState, useEffect, use, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus,
  X,
  ArrowLeft,
  Trash2,
  Edit3,
  FileText,
  Paperclip,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Rocket,
  Sparkles,
  Bug,
  Check,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { useImageLightbox } from '@/components/image-lightbox'
import { getSocket } from '@/lib/socket-client'

interface TicketItem {
  id: string
  title: string
  description: string | null
  type: 'DEPLOY' | 'FEATURE' | 'BUGFIX' | 'OTHER' | string
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

const TYPE_CONFIG = {
  DEPLOY:  { label: 'Deployment',  icon: Rocket,   color: 'text-indigo-600' },
  FEATURE: { label: 'Fitur Baru',  icon: Sparkles, color: 'text-amber-600' },
  BUGFIX:  { label: 'Bug Report',  icon: Bug,      color: 'text-rose-600' },
  OTHER:   { label: 'Lainnya',     icon: FileText, color: 'text-zinc-600' },
}

const STATUS_CONFIG = {
  PENDING:  { label: 'Menunggu Review PM', dot: 'bg-amber-500',   badge: 'bg-amber-50/80 text-amber-800 border-amber-200/70' },
  APPROVED: { label: 'Disetujui PM',       dot: 'bg-emerald-500', badge: 'bg-emerald-50/80 text-emerald-800 border-emerald-200/70' },
  REVISION: { label: 'Perlu Revisi Klien', dot: 'bg-sky-500',     badge: 'bg-sky-50/80 text-sky-800 border-sky-200/70' },
  REJECTED: { label: 'Ditolak',            dot: 'bg-zinc-400',    badge: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
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

  // PM Review Modal State
  const [reviewModalTicket, setReviewModalTicket] = useState<TicketItem | null>(null)
  const [pmNotes, setPmNotes] = useState('')
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED' | 'REVISION'>('APPROVED')
  const [savingReview, setSavingReview] = useState(false)

  const userId = (session?.user as any)?.id
  const userRole = session?.user?.role

  const isPMorAdmin = userRole === 'ADMIN' ||
    members.some(m => m.user.id === userId && m.role === 'PM')

  const isDeveloper = (userRole === 'DEVELOPER' ||
    members.some(m => m.user.id === userId && m.role === 'DEVELOPER')) && !isPMorAdmin

  // Hanya Klien yang bisa membuat tiket permintaan
  const canCreate = !isPMorAdmin && !isDeveloper

  const canDelete = (t: TicketItem) =>
    isPMorAdmin || t.createdBy.id === userId

  // 1. Fetch project members
  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(data => { if (data?.members) setMembers(data.members) })
      .catch(() => {})
  }, [id])

  // 2. Fetch initial tickets
  useEffect(() => {
    const qs = filter ? `?status=${filter}` : ''
    fetch(`/api/projects/${id}/tickets${qs}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Jika developer, pastikan hanya tampil yang APPROVED
          if (isDeveloper) {
            setTickets(data.filter(t => t.status === 'APPROVED'))
          } else {
            setTickets(data)
          }
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, filter, isDeveloper])

  // 3. Realtime WebSocket listener
  useEffect(() => {
    const socket = getSocket()
    socket.emit('join:project', { projectId: id })

    const handleTicketNew = (newTicket: TicketItem) => {
      // Developer tidak menerima notifikasi/tiket jika belum APPROVED
      if (isDeveloper && newTicket.status !== 'APPROVED') return

      setTickets(prev => {
        if (prev.some(t => t.id === newTicket.id)) return prev
        return [newTicket, ...prev]
      })
    }

    const handleTicketUpdated = (updatedTicket: TicketItem) => {
      setTickets(prev => {
        if (isDeveloper && updatedTicket.status !== 'APPROVED') {
          // Jika bukan APPROVED lagi, sembunyikan dari developer
          return prev.filter(t => t.id !== updatedTicket.id)
        }
        const exists = prev.some(t => t.id === updatedTicket.id)
        if (!exists && (!isDeveloper || updatedTicket.status === 'APPROVED')) {
          return [updatedTicket, ...prev]
        }
        return prev.map(t => t.id === updatedTicket.id ? updatedTicket : t)
      })
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
  }, [id, isDeveloper])

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

  function openReviewModal(ticket: TicketItem) {
    setReviewModalTicket(ticket)
    setReviewStatus(ticket.status === 'PENDING' ? 'APPROVED' : (ticket.status as any))
    setPmNotes(ticket.pmNotes || '')
  }

  function closeReviewModal() {
    setReviewModalTicket(null)
    setPmNotes('')
    setSavingReview(false)
  }

  async function handleSaveReview(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewModalTicket) return
    setSavingReview(true)

    const currentTicketId = reviewModalTicket.id
    const currentStatus = reviewStatus
    const currentNotes = pmNotes.trim() || null

    setTickets(prev => prev.map(t => t.id === currentTicketId
      ? { ...t, status: currentStatus, pmNotes: currentNotes }
      : t
    ))

    try {
      await fetch(`/api/projects/${id}/tickets/${currentTicketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentStatus, pmNotes: currentNotes }),
      })
    } catch (err) {
      console.error(err)
    } finally {
      closeReviewModal()
    }
  }

  async function deleteTicket(ticketId: string) {
    if (!confirm('Hapus tiket permintaan ini secara permanen?')) return
    setTickets(prev => prev.filter(t => t.id !== ticketId))
    try {
      await fetch(`/api/projects/${id}/tickets/${ticketId}`, { method: 'DELETE' })
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-sm text-zinc-600 font-medium">
        Memuat tiket permintaan...
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto pt-3 pb-16 px-3 sm:px-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}`}
            className="btn-secondary w-9 h-9 p-0 rounded-full inline-flex items-center justify-center no-underline shrink-0"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 m-0">
                Tiket Permintaan
              </h1>
              <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 rounded-full">
                Client Intake
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1 mb-0">
              Saluran permintaan fitur, revisi, dan rilis dari klien yang dikurasi oleh PM sebelum dieksekusi.
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-1.5 shrink-0 cursor-pointer text-xs sm:text-sm py-2 px-4"
          >
            <Plus size={15} /> Ajukan Permintaan
          </button>
        )}
      </div>

      {/* Developer Context Banner */}
      {isDeveloper && (
        <div className="card p-3.5 mb-5 bg-sky-50/60 border-sky-200/80 text-sky-900 text-xs flex items-center gap-2.5">
          <ShieldCheck size={18} className="text-sky-600 shrink-0" />
          <div>
            <span className="font-semibold">Mode Developer:</span> Hanya menampilkan tiket yang telah{' '}
            <strong className="font-semibold text-emerald-700">disetujui PM</strong>. Tiket yang masih pending atau dalam revisi disaring otomatis agar tidak mengganggu alur kerja teknis.
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      {!isDeveloper && (
        <div className="card p-2 sm:p-2.5 mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: '', label: 'Semua', count: tickets.length },
              { key: 'PENDING', label: 'Menunggu Review', count: tickets.filter(t => t.status === 'PENDING').length },
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                    active
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                      : 'bg-transparent text-zinc-600 border-transparent hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      active ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="text-[11px] text-zinc-400 font-mono px-2 hidden sm:block">
            {tickets.length} Tiket Tercatat
          </div>
        </div>
      )}

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="card p-12 text-center text-xs text-zinc-500">
          <AlertCircle size={28} className="mx-auto mb-2 text-zinc-300" />
          <p className="m-0 font-semibold text-sm text-zinc-800">Belum ada tiket</p>
          <p className="mt-1 text-zinc-500">
            {isDeveloper
              ? 'Belum ada tiket permintaan klien yang disetujui PM untuk dikerjakan saat ini.'
              : filter
              ? 'Tidak ada tiket dengan filter status ini.'
              : 'Klien dapat mengajukan permintaan perubahan fitur atau deploy untuk ditinjau oleh PM.'}
          </p>
          {canCreate && !filter && (
            <button
              onClick={openCreateModal}
              className="btn-primary mt-4 text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Buat Permintaan Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map(ticket => {
            const statusMeta = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.PENDING
            const typeMeta = TYPE_CONFIG[ticket.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.OTHER
            const TypeIcon = typeMeta.icon
            const isCreator = ticket.createdBy.id === userId
            const isRevision = ticket.status === 'REVISION'
            const shortCode = ticket.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()

            return (
              <div
                key={ticket.id}
                className="card p-4 sm:p-5 flex flex-col gap-3 transition-all hover:border-zinc-300"
              >
                {/* Top Row: Meta Badges & Actions */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Code Tag */}
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200/80">
                      #{shortCode}
                    </span>

                    {/* Type Tag */}
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-200/70 text-zinc-700">
                      <TypeIcon size={12} className={typeMeta.color} />
                      <span>{typeMeta.label}</span>
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusMeta.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                      <span>{statusMeta.label}</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {/* Creator Edit if Revision or Pending */}
                    {isCreator && (ticket.status === 'REVISION' || ticket.status === 'PENDING') && (
                      <button
                        onClick={() => openEditModal(ticket)}
                        className={`text-xs px-2.5 py-1 rounded-lg inline-flex items-center gap-1 cursor-pointer font-medium ${
                          isRevision
                            ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                            : 'btn-secondary'
                        }`}
                      >
                        <Edit3 size={12} />
                        <span>{isRevision ? 'Perbaiki Permintaan' : 'Edit'}</span>
                      </button>
                    )}

                    {/* PM Review Button */}
                    {isPMorAdmin && (
                      <button
                        onClick={() => openReviewModal(ticket)}
                        className="btn-secondary text-xs px-2.5 py-1 rounded-lg inline-flex items-center gap-1 cursor-pointer font-medium hover:bg-zinc-200"
                        title="Tinjau dan buat keputusan PM"
                      >
                        <ShieldCheck size={13} className="text-indigo-600" />
                        <span>Review PM</span>
                      </button>
                    )}

                    {/* Delete */}
                    {canDelete(ticket) && (
                      <button
                        onClick={() => deleteTicket(ticket.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                        title="Hapus tiket"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-900 m-0 leading-snug">
                    {ticket.title}
                  </h3>
                  {ticket.description && (
                    <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed mt-1 mb-0 whitespace-pre-wrap wrap-break-word">
                      {ticket.description}
                    </p>
                  )}
                </div>

                {/* Attachments */}
                {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(ticket.attachments as string[]).map((url, i) => {
                      const isImg = /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(url)
                      if (isImg) {
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openImage(url)}
                            className="inline-flex items-center gap-1.5 p-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors cursor-pointer text-zinc-600 text-xs"
                          >
                            <img src={url} alt={`attachment ${i+1}`} className="w-6 h-6 object-cover rounded" />
                            <span className="max-w-28 truncate">{url.split('/').pop() || `Lampiran ${i + 1}`}</span>
                          </button>
                        )
                      }
                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors text-zinc-600 text-xs no-underline"
                        >
                          <FileText size={13} className="text-blue-600" />
                          <span className="max-w-28 truncate">{url.split('/').pop() || `Lampiran ${i + 1}`}</span>
                        </a>
                      )
                    })}
                  </div>
                )}

                {/* PM Notes Callout */}
                {ticket.pmNotes && (
                  <div className="p-3 rounded-lg bg-amber-50/70 border-l-2 border-amber-500 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-0.5">
                      <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                      <span>Catatan Project Manager:</span>
                    </div>
                    <p className="text-amber-950/80 m-0 leading-relaxed whitespace-pre-wrap">
                      {ticket.pmNotes}
                    </p>
                  </div>
                )}

                {/* Footer Metadata */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span>Diajukan oleh</span>
                    <strong className="text-zinc-700 font-semibold">{ticket.createdBy.name}</strong>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-500 font-medium">
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
              </div>
            )
          })}
        </div>
      )}

      {/* Modal PM Review */}
      {reviewModalTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 m-0">Review Permintaan Klien</h3>
                  <p className="text-[11px] text-zinc-500 m-0 truncate max-w-60">
                    {reviewModalTicket.title}
                  </p>
                </div>
              </div>
              <button
                onClick={closeReviewModal}
                className="w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 flex items-center justify-center border-none bg-transparent cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveReview} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-2">Keputusan PM</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'APPROVED', label: 'Setujui', desc: 'Teruskan ke developer', border: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                    { key: 'REVISION', label: 'Revisi',   desc: 'Minta klien lengkapi', border: 'border-sky-500 bg-sky-50 text-sky-800' },
                    { key: 'REJECTED', label: 'Tolak',    desc: 'Tidak dikerjakan',      border: 'border-zinc-500 bg-zinc-100 text-zinc-800' },
                  ].map(item => {
                    const selected = reviewStatus === item.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setReviewStatus(item.key as any)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-0.5 ${
                          selected
                            ? `${item.border} shadow-xs font-semibold`
                            : 'border-zinc-200 bg-zinc-50/70 text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className="text-[10px] text-zinc-500 leading-tight">{item.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">
                  Catatan Review <span className="text-zinc-400 font-normal">(opsional / instruksi revisi)</span>
                </label>
                <textarea
                  rows={3}
                  value={pmNotes}
                  onChange={e => setPmNotes(e.target.value)}
                  placeholder="Instruksi untuk klien jika revisi, atau catatan pengerjaan untuk developer..."
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-zinc-200 outline-none focus:border-zinc-400 resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  className="btn-secondary text-xs py-2 px-3.5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingReview}
                  className="btn-primary text-xs py-2 px-4"
                >
                  {savingReview ? 'Menyimpan...' : 'Simpan Keputusan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buat / Edit Ticket Klien */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 m-0">
                    {editingTicket ? 'Perbarui Tiket Permintaan' : 'Ajukan Permintaan Baru'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 m-0">
                    {editingTicket
                      ? 'Setelah disimpan, status tiket akan kembali ke antrean Menunggu Review PM'
                      : 'Permintaan akan ditinjau dan divalidasi oleh Project Manager'}
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
                  {Object.entries(TYPE_CONFIG).map(([k, meta]) => {
                    const Icon = meta.icon
                    const isSel = type === k
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setType(k)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border text-left cursor-pointer transition-all ${
                          isSel
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <Icon size={14} className={isSel ? 'text-amber-400' : meta.color} />
                        <span>{meta.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Judul Permintaan</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Contoh: Perubahan copy headline pada halaman pricing..."
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-zinc-200 outline-none focus:border-zinc-400 font-sans"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">
                  Deskripsi / Konteks <span className="text-zinc-400 font-normal">(opsional)</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Jelaskan kebutuhan, perubahan yang diharapkan, atau tautan referensi..."
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

                {/* Existing files */}
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
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                        <span className="max-w-28 truncate">{p.file.name}</span>
                        <button
                          type="button"
                          onClick={() => removePendingFile(i)}
                          className="text-amber-500 hover:text-rose-600 border-none bg-transparent p-0 cursor-pointer"
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
                  className="btn-secondary text-xs py-2 px-3.5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="btn-primary text-xs py-2 px-4"
                >
                  {submitting ? 'Menyimpan...' : editingTicket ? 'Simpan Pembaruan' : 'Kirim Permintaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
