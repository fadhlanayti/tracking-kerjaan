'use client'
import { useState, useEffect, use, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Send,
  Paperclip,
  X,
  FileText,
  AlertTriangle,
  Rocket,
  Sparkles,
  Bug,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useImageLightbox } from '@/components/image-lightbox'
import { getSocket } from '@/lib/socket-client'

interface TicketComment {
  id: string
  content: string
  attachments: string[]
  author: { id: string; name: string; avatar: string | null; role: string }
  createdAt: string
  _optimistic?: boolean   // bubble sementara, masih upload
}

interface TicketDetail {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  pmNotes: string | null
  attachments: string[]
  createdAt: string
  createdBy: { id: string; name: string; role: string; avatar?: string | null }
  comments: TicketComment[]
}

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  DEPLOY:  { label: 'Deployment', icon: Rocket,   color: 'text-indigo-600' },
  FEATURE: { label: 'Fitur Baru', icon: Sparkles, color: 'text-amber-600' },
  BUGFIX:  { label: 'Bug Report', icon: Bug,      color: 'text-rose-600' },
  OTHER:   { label: 'Lainnya',    icon: FileText,  color: 'text-zinc-600' },
}

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  PENDING:  { label: 'Menunggu Review PM', dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPROVED: { label: 'Disetujui PM',       dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  REVISION: { label: 'Perlu Revisi Klien', dot: 'bg-sky-500',     badge: 'bg-sky-50 text-sky-800 border-sky-200' },
  REJECTED: { label: 'Ditolak',            dot: 'bg-zinc-400',    badge: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
}

function getAvatarColor(name: string) {
  const colors = ['bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string; ticketId: string }> }) {
  const { id, ticketId } = use(params)
  const { data: session } = useSession()
  const { openImage } = useImageLightbox()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [loading, setLoading] = useState(true)
  const [msgText, setMsgText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Set of real comment IDs that we sent ourselves — socket harus skip ini
  const myPendingIds = useRef<Set<string>>(new Set())

  const MAX_FILE_SIZE = 15 * 1024 * 1024
  const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.pdf', '.zip', '.mp4', '.webm']

  useEffect(() => {
    fetch(`/api/projects/${id}/tickets/${ticketId}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setTicket(data)
          setComments(data.comments || [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, ticketId])

  // Socket live update
  useEffect(() => {
    const socket = getSocket()
    socket.emit('join:project', { projectId: id })

    const handleNewComment = (payload: { ticketId: string; comment: TicketComment }) => {
      if (payload.ticketId !== ticketId) return
      // Skip jika ini comment kita sendiri (sudah di-handle oleh handleSend)
      if (myPendingIds.current.has(payload.comment.id)) {
        myPendingIds.current.delete(payload.comment.id)
        return
      }
      setComments(prev => {
        if (prev.some(c => c.id === payload.comment.id)) return prev
        return [...prev, payload.comment]
      })
    }

    const handleTicketUpdated = (updated: any) => {
      if (updated.id === ticketId) {
        setTicket(prev => prev ? { ...prev, ...updated } : prev)
      }
    }

    socket.on('ticket-comment:new', handleNewComment)
    socket.on('ticket:updated', handleTicketUpdated)

    return () => {
      socket.off('ticket-comment:new', handleNewComment)
      socket.off('ticket:updated', handleTicketUpdated)
    }
  }, [id, ticketId])

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  // Auto grow textarea
  function autoGrow() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function handlePickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const validFiles: { file: File; preview: string }[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > MAX_FILE_SIZE) continue
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_EXTS.includes(ext)) continue
      validFiles.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      })
    }
    if (validFiles.length > 0) setPendingFiles(prev => [...prev, ...validFiles])
    if (e.target) e.target.value = ''
  }

  function removePendingFile(i: number) {
    setPendingFiles(prev => {
      URL.revokeObjectURL(prev[i].preview)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = msgText.trim()
    const filesToSend = [...pendingFiles]
    if (!text && filesToSend.length === 0) return

    // 1. Langsung render bubble optimistic dengan preview lokal
    const tempId = `temp-${Date.now()}`
    const optimisticAttachments = filesToSend.map(f => f.preview || f.file.name)
    const optimisticComment: TicketComment = {
      id: tempId,
      content: text,
      attachments: optimisticAttachments,
      author: {
        id: (session?.user as any)?.id || '',
        name: session?.user?.name || '',
        avatar: (session?.user as any)?.avatar || null,
        role: session?.user?.role || '',
      },
      createdAt: new Date().toISOString(),
      _optimistic: true,
    }

    setComments(prev => [...prev, optimisticComment])
    setMsgText('')
    setPendingFiles([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // 2. Upload files + kirim ke server di background
    try {
      const uploadedUrls: string[] = []
      for (const { file } of filesToSend) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/upload', { method: 'POST', body: formData })
          const data = await res.json()
          if (data.url) uploadedUrls.push(data.url)
        } catch {}
      }

      const res = await fetch(`/api/projects/${id}/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, attachments: uploadedUrls }),
      })

      if (res.ok) {
        const real = await res.json()
        // Register ID agar socket handler skip duplicate
        myPendingIds.current.add(real.id)
        // Ganti bubble optimistic dengan data real dari server
        setComments(prev => prev.map(c => c.id === tempId ? { ...real, _optimistic: false } : c))
        // Cleanup preview URLs
        filesToSend.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview) })
      } else {
        // Gagal — tandai bubble sebagai error (tetap tampil tapi ada indikator)
        setComments(prev => prev.filter(c => c.id !== tempId))
      }
    } catch {
      setComments(prev => prev.filter(c => c.id !== tempId))
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e as any)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-zinc-500 font-medium">
        Memuat detail tiket...
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="max-w-3xl mx-auto p-6 rounded-2xl bg-red-50 text-red-600 border border-red-200 text-sm mt-8">
        Tiket tidak ditemukan
      </div>
    )
  }

  const typeMeta = TYPE_META[ticket.type] || TYPE_META.OTHER
  const statusMeta = STATUS_META[ticket.status] || STATUS_META.PENDING
  const TypeIcon = typeMeta.icon
  const shortCode = ticket.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()

  return (
    <div className="w-full max-w-3xl mx-auto pt-4 pb-6 px-3 sm:px-6 flex flex-col" style={{ minHeight: 'calc(100vh - var(--topbar-height) - 4rem)' }}>
      {/* Back */}
      <div className="mb-4">
        <Link
          href={`/projects/${id}/tickets`}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 border border-zinc-200/90 shadow-2xs text-xs font-semibold no-underline transition-all"
        >
          <ArrowLeft size={14} className="text-zinc-500" />
          <span>Kembali ke Tiket</span>
        </Link>
      </div>

      {/* Ticket Info Card */}
      <div className="card p-4 sm:p-5 mb-5">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200/80">
            #{shortCode}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-200/70 text-zinc-700">
            <TypeIcon size={12} className={typeMeta.color} />
            <span>{typeMeta.label}</span>
          </span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusMeta.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
            <span>{statusMeta.label}</span>
          </span>
        </div>

        <h1 className="text-base sm:text-lg font-bold text-zinc-900 m-0 leading-snug">{ticket.title}</h1>

        {ticket.description && (
          <p className="text-sm text-zinc-600 leading-relaxed mt-2 mb-0 whitespace-pre-wrap wrap-break-word">
            {ticket.description}
          </p>
        )}

        {/* Ticket attachments */}
        {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {ticket.attachments.map((url, i) => {
              const isImg = /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(url)
              if (isImg) {
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openImage(url)}
                    className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-200 cursor-pointer bg-zinc-50 hover:opacity-80 transition-opacity p-0"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                )
              }
              return (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-600 no-underline hover:bg-zinc-100"
                >
                  <FileText size={13} className="text-blue-600" />
                  <span className="max-w-24 truncate">{url.split('/').pop()}</span>
                </a>
              )
            })}
          </div>
        )}

        {/* PM Notes */}
        {ticket.pmNotes && (
          <div className="p-3 rounded-lg bg-amber-50/70 border-l-2 border-amber-500 text-xs mt-3">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-0.5">
              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
              <span>Catatan PM:</span>
            </div>
            <p className="text-amber-950/80 m-0 leading-relaxed whitespace-pre-wrap">{ticket.pmNotes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-zinc-100 text-[11px] text-zinc-400">
          <span>Diajukan oleh</span>
          <strong className="text-zinc-700">{ticket.createdBy.name}</strong>
          <span className="px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-500 font-medium text-[10px]">
            {ticket.createdBy.role}
          </span>
          <span className="ml-auto">{formatTime(ticket.createdAt)}</span>
        </div>
      </div>

      {/* Chat Thread */}
      <div className="card flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2 shrink-0">
          <ShieldCheck size={16} className="text-indigo-500" />
          <span className="text-sm font-semibold text-zinc-900">Update & Diskusi</span>
          <span className="ml-auto text-[11px] text-zinc-400 font-mono">{comments.length} pesan</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-50 max-h-[50vh] sm:max-h-[55vh]">
          {comments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 text-xs">
              <ShieldCheck size={28} className="mb-2 text-zinc-300" />
              <p className="font-medium text-zinc-500">Belum ada pesan</p>
              <p className="text-zinc-400 mt-0.5">Kirim update atau lampiran untuk memulai diskusi.</p>
            </div>
          )}

          {comments.map(c => {
            const isMe = c.author.id === (session?.user as any)?.id
            // Optimistic: attachments bisa berupa blob: URL atau nama file
            const isOptimistic = !!(c as any)._optimistic
            const images = (c.attachments || []).filter(u => /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(u) || u.startsWith('blob:'))
            const files = (c.attachments || []).filter(u => !/\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(u) && !u.startsWith('blob:'))
            const avatarColor = getAvatarColor(c.author.name)

            return (
              <div key={c.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''} ${isOptimistic ? 'opacity-60' : ''} transition-opacity`}>
                {/* Avatar */}
                {c.author.avatar ? (
                  <img src={c.author.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className={`w-8 h-8 rounded-full ${avatarColor} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                    {c.author.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Bubble */}
                <div className={`max-w-[75%] sm:max-w-[65%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  {!isMe && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-semibold text-zinc-800">{c.author.name}</span>
                      <span className="text-[10px] text-zinc-400 font-medium">{c.author.role}</span>
                    </div>
                  )}

                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isMe
                      ? 'bg-zinc-900 text-white rounded-tr-md'
                      : 'bg-zinc-100 text-zinc-900 rounded-tl-md'
                  }`}>
                    {c.content && <p className="m-0 whitespace-pre-wrap wrap-break-word">{c.content}</p>}

                    {/* Image Grid */}
                    {images.length > 0 && (
                      <div className={`grid gap-1.5 mt-2 ${
                        images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                      }`}>
                        {images.map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openImage(url)}
                            className="rounded-lg overflow-hidden cursor-pointer border-none p-0 bg-transparent"
                          >
                            <img
                              src={url}
                              alt={`img-${i}`}
                              className="w-full max-h-48 object-cover rounded-lg hover:opacity-90 transition-opacity"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* File links */}
                    {files.length > 0 && (
                      <div className="flex flex-col gap-1 mt-2">
                        {files.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1.5 text-xs no-underline ${
                              isMe ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'
                            }`}
                          >
                            <FileText size={12} />
                            <span className="truncate max-w-40">{url.split('/').pop()}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className={`text-[10px] text-zinc-400 mt-0.5 ${isMe ? 'text-right' : ''}`}>
                    {formatTime(c.createdAt)}
                  </span>
                </div>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Pending Files Preview */}
        {pendingFiles.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-100 flex flex-wrap gap-2 bg-zinc-50/50">
            {pendingFiles.map((p, i) => (
              <div key={i} className="relative group">
                {p.preview ? (
                  <img src={p.preview} alt="" className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-zinc-200" />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg border border-zinc-200 bg-zinc-100 flex flex-col items-center justify-center text-[10px] text-zinc-500 p-1">
                    <FileText size={16} className="mb-0.5" />
                    <span className="truncate w-full text-center">{p.file.name.split('.').pop()}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePendingFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 text-white flex items-center justify-center border-none cursor-pointer shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Bar - sticky bottom */}
        <form onSubmit={handleSend} className="px-3 sm:px-4 py-3 border-t border-zinc-200/80 bg-white shrink-0">
          <div className="flex items-end gap-2">
            {/* Attach Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center border-none cursor-pointer transition-colors shrink-0"
              title="Lampirkan file"
            >
              <Paperclip size={16} />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.pdf,.zip,.mp4,.webm"
              className="hidden"
              onChange={handlePickFiles}
            />

            {/* Text Input */}
            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                rows={1}
                value={msgText}
                onChange={e => { setMsgText(e.target.value); autoGrow() }}
                onKeyDown={handleKeyDown}
                placeholder="Tulis update atau lampirkan file..."
                className="w-full text-sm p-2.5 sm:p-3 rounded-xl border border-zinc-200 outline-none focus:border-zinc-400 resize-none font-sans leading-snug"
                style={{ maxHeight: 120 }}
              />
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!msgText.trim() && pendingFiles.length === 0}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center border-none cursor-pointer transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
