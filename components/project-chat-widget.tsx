'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Send, X, MessageSquare, Image as ImageIcon } from 'lucide-react'
import { getSocket } from '@/lib/socket-client'

interface Message {
  id: string
  content: string
  attachments: string[]
  sender: { id: string; name: string; avatar: string | null }
  createdAt: string
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(date: string) {
  const d = new Date(date)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Hari ini'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function ProjectChatWidget({ projectId, isOpen, onClose }: { projectId: string; isOpen: boolean; onClose: () => void }) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Fetch initial messages when chat drawer opens
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)

    fetch(`/api/projects/${projectId}/chat/messages`)
      .then(r => r.json())
      .then(data => {
        if (data.messages) setMessages(data.messages)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId, isOpen])

  // 2. Realtime Socket listener — always active for this project room
  useEffect(() => {
    if (!projectId) return

    const socket = getSocket()
    const joinRoom = () => {
      socket.emit('join:project', {
        projectId,
        userId: session?.user?.id,
        userName: session?.user?.name,
      })
    }

    joinRoom()
    socket.on('connect', joinRoom)

    const handleNewMessage = (message: Message) => {
      setMessages(prev => (prev.some(m => m.id === message.id) ? prev : [...prev, message]))
    }

    socket.on('message:new', handleNewMessage)

    return () => {
      socket.off('connect', joinRoom)
      socket.off('message:new', handleNewMessage)
    }
  }, [projectId, session?.user?.id, session?.user?.name])

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages, isOpen])

  function handlePickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFiles = Array.from(files).map(file => ({ file, preview: URL.createObjectURL(file) }))
    setPendingFiles(prev => [...prev, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removePendingFile(i: number) {
    setPendingFiles(prev => {
      URL.revokeObjectURL(prev[i].preview)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() && pendingFiles.length === 0) return

    const content = input.trim() || ''
    const previews = pendingFiles.map(f => f.preview)
    const filesToUpload = [...pendingFiles]

    // Optimistic: show message immediately with blob previews
    const tempId = `temp-${Date.now()}`
    const optimisticMsg: Message = {
      id: tempId,
      content,
      attachments: previews,
      sender: {
        id: session?.user?.id || '',
        name: session?.user?.name || '',
        avatar: null,
      },
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    setInput('')
    setPendingFiles([])

    // Upload + save in background
    try {
      const uploadedUrls: string[] = []
      for (const { file } of filesToUpload) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/upload', { method: 'POST', body: formData })
          if (res.ok) {
            const data = await res.json()
            if (data.url) uploadedUrls.push(data.url)
          }
        } catch { /* skip failed uploads */ }
      }

      const res = await fetch(`/api/projects/${projectId}/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, attachments: uploadedUrls }),
      })

      if (res.ok) {
        const message = await res.json()
        const socket = getSocket()
        socket.emit('message:send', { ...message, projectId })
        // Replace optimistic message with real one
        setMessages(prev => prev.map(m => m.id === tempId ? message : m))
      }

      // Revoke blob URLs
      filesToUpload.forEach(f => URL.revokeObjectURL(f.preview))
    } catch (err) {
      console.error(err)
    }
  }

  if (!isOpen) return null

  let lastDate = ''

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[360px] h-[550px] bg-[#202524] rounded-2xl shadow-2xl border border-[#2c3332] overflow-hidden animate-in slide-in-from-bottom-5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#202524] border-b border-[#2c3332] shadow-sm relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#0071E3]/20 text-[#0071E3] flex items-center justify-center">
            <MessageSquare size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Project Chat</h3>
            <p className="text-[10px] text-zinc-400 font-medium">Discussion</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 cursor-pointer border-none bg-transparent transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#181a1a]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">Loading chat...</div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <MessageSquare size={32} className="text-zinc-700 mb-2" />
            <p className="text-sm font-medium text-zinc-400">No messages yet</p>
            <p className="text-xs text-zinc-500 mt-1">Be the first to say hello!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg, idx) => {
              const isMe = msg.sender.id === session?.user?.id
              const msgDate = formatDate(msg.createdAt)
              const showDate = msgDate !== lastDate
              lastDate = msgDate
              const prevMsg = idx > 0 ? messages[idx - 1] : null
              const showSender = !isMe && (!prevMsg || prevMsg.sender.id !== msg.sender.id || showDate)

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="text-center my-3.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-950/70 px-3.5 py-1 rounded-full shadow-xs border border-blue-500/30">
                        {msgDate}
                      </span>
                    </div>
                  )}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${showSender ? 'mt-3' : 'mt-0.5'}`}>
                    {showSender && (
                      <span className="text-[11px] font-semibold text-zinc-400 mb-1 ml-1">{msg.sender.name}</span>
                    )}
                    <div
                      className={`relative max-w-[85%] text-[13px] shadow-sm ${
                        isMe
                          ? 'bg-[#0071E3] text-white rounded-[1.25rem] rounded-br-[0.25rem]'
                          : 'bg-[#2a302f] text-zinc-100 rounded-[1.25rem] rounded-bl-[0.25rem]'
                      } ${msg.content ? 'px-3.5 py-2.5' : 'p-1.5'}`}
                      style={{ lineHeight: '1.4' }}
                    >
                      {/* Media Photos Grid (WhatsApp / Telegram style) */}
                      {msg.attachments?.length > 0 && (
                        <div className={msg.content ? 'mb-2' : ''}>
                          {(() => {
                            const images = msg.attachments.filter(url =>
                              url.startsWith('blob:') ||
                              url.startsWith('data:image/') ||
                              /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(url.split('?')[0]) ||
                              url.startsWith('/uploads/')
                            )
                            const otherFiles = msg.attachments.filter(url => !images.includes(url))

                            return (
                              <>
                                {images.length === 1 && (
                                  <a href={images[0]} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl">
                                    <img
                                      src={images[0]}
                                      alt="attachment"
                                      className="max-w-[240px] max-h-[260px] w-full rounded-xl object-cover hover:opacity-95 transition-opacity"
                                    />
                                  </a>
                                )}

                                {images.length === 2 && (
                                  <div className="grid grid-cols-2 gap-1 max-w-[260px] rounded-xl overflow-hidden">
                                    {images.map((url, i) => (
                                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden">
                                        <img src={url} alt={`img-${i}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {images.length === 3 && (
                                  <div className="grid grid-cols-2 gap-1 max-w-[260px] rounded-xl overflow-hidden">
                                    <a href={images[0]} target="_blank" rel="noopener noreferrer" className="row-span-2 block overflow-hidden">
                                      <img src={images[0]} alt="img-0" className="w-full h-full object-cover min-h-[160px] hover:scale-105 transition-transform duration-200" />
                                    </a>
                                    <div className="grid grid-rows-2 gap-1">
                                      {images.slice(1).map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden">
                                          <img src={url} alt={`img-${i+1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {images.length >= 4 && (
                                  <div className="grid grid-cols-2 gap-1 max-w-[260px] rounded-xl overflow-hidden">
                                    {images.slice(0, 4).map((url, i) => (
                                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden group">
                                        <img src={url} alt={`img-${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                                        {i === 3 && images.length > 4 && (
                                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white font-bold text-base">
                                            +{images.length - 4}
                                          </div>
                                        )}
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {otherFiles.length > 0 && (
                                  <div className="flex flex-col gap-1 mt-1.5 px-1">
                                    {otherFiles.map((url, i) => (
                                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline text-blue-200 hover:text-white truncate block">
                                        📄 File {i + 1}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      )}

                      {/* Text content (jika ada) */}
                      {msg.content ? (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-medium text-zinc-400 mt-1 mx-1">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Pending file previews */}
      {pendingFiles.length > 0 && (
        <div className="flex gap-2 px-3 py-2 bg-[#202524] border-t border-[#2c3332] overflow-x-auto">
          {pendingFiles.map((item, i) => (
            <div key={i} className="relative shrink-0">
              <img src={item.preview} alt="" className="w-16 h-12 object-cover rounded-lg border border-[#2c3332]" />
              <button
                type="button"
                onClick={() => removePendingFile(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center border-none cursor-pointer p-0"
              >
                <X size={9} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 bg-[#202524] border-t border-[#2c3332]">
        <form onSubmit={sendMessage} className="flex items-center gap-2 p-1.5 bg-[#181a1a] rounded-full focus-within:bg-[#202524] transition-all">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-zinc-400 hover:text-white transition-colors border-none bg-transparent cursor-pointer shrink-0">
            <ImageIcon size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" multiple className="hidden" onChange={handlePickFiles} />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as any) } }}
            placeholder="Tulis pesan..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none border-none"
          />
          <button
            type="submit"
            disabled={!input.trim() && pendingFiles.length === 0}
            className="w-8 h-8 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white flex items-center justify-center border-none cursor-pointer shrink-0 disabled:opacity-40 transition-all active:scale-95 shadow-md shadow-blue-500/20"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  )
}
