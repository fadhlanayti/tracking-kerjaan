'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Bell, LogOut, Menu, X, User, Camera, Loader2, Edit3, Linkedin, Github } from 'lucide-react'
import { useSidebar } from './providers'
import { useRouter } from 'next/navigation'
import { getSocket } from '@/lib/socket-client'

interface Notification {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
  referenceId?: string | null
  referenceType?: string | null
}

const NOTIF_LIMIT = 4

export function Topbar() {
  const { data: session } = useSession()
  const { toggle } = useSidebar()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<{
    id: string
    name: string
    email: string
    phone?: string | null
    avatar?: string | null
    position?: string | null
    linkedin?: string | null
    github?: string | null
    role: string
  } | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePosition, setProfilePosition] = useState('')
  const [profileLinkedin, setProfileLinkedin] = useState('')
  const [profileGithub, setProfileGithub] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch profil terbaru dari database saat dimuat
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/users/me')
        .then(r => r.json())
        .then(data => {
          if (data && !data.error) {
            setCurrentUser(data)
            setProfileName(data.name || '')
            setProfilePosition(data.position || '')
            setProfileLinkedin(data.linkedin || '')
            setProfileGithub(data.github || '')
            setProfilePhone(data.phone || '')
          }
        })
        .catch(() => {})
    }
  }, [session?.user?.id])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !session?.user?.id) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const { url } = await uploadRes.json()

      const patchRes = await fetch(`/api/users/${session.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: url }),
      })
      if (patchRes.ok) {
        const updated = await patchRes.json()
        setCurrentUser(prev => (prev ? { ...prev, avatar: url } : null))
      }
    } catch {
      alert('Gagal mengupload avatar')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user?.id || !profileName.trim()) return

    setSavingProfile(true)
    try {
      const res = await fetch(`/api/users/${session.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName.trim(),
          position: profilePosition.trim() || null,
          linkedin: profileLinkedin.trim() || null,
          github: profileGithub.trim() || null,
          phone: profilePhone.trim() || null,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setCurrentUser(prev => (prev ? { ...prev, ...updated } : null))
        setShowProfileModal(false)
      } else {
        alert('Gagal menyimpan profil')
      }
    } catch {
      alert('Terjadi kesalahan')
    } finally {
      setSavingProfile(false)
    }
  }

  // Swipe state per notif
  const [swipeX, setSwipeX] = useState<Record<string, number>>({})
  const touchStartX = useRef<Record<string, number>>({})

  useEffect(() => {
    const load = () =>
      fetch('/api/notifications')
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setNotifications(d) })
        .catch(() => {})
    load()
    const t = setInterval(load, 30000)

    const userId = session?.user?.id
    if (userId) {
      const socket = getSocket()
      const joinUser = () => socket.emit('join:user', { userId })
      joinUser()
      socket.on('connect', joinUser)

      const handleNewNotif = (notif: Notification) => {
        setNotifications(prev => [notif, ...prev.filter(n => n.id !== notif.id)])
      }
      socket.on('notification:new', handleNewNotif)

      return () => {
        clearInterval(t)
        socket.off('connect', joinUser)
        socket.off('notification:new', handleNewNotif)
      }
    }

    return () => clearInterval(t)
  }, [session?.user?.id])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
        setShowAll(false)
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notifications.filter(n => !n.read).length
  const displayed = showAll ? notifications : notifications.slice(0, NOTIF_LIMIT)

  async function handleNotifClick(n: Notification) {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
    setShowNotifs(false)
    setShowAll(false)

    if (!n.referenceId || !n.referenceType) return
    const res = await fetch(`/api/notifications/${n.id}/navigate`)
    if (res.ok) {
      const { url } = await res.json()
      if (url) router.push(url)
    }
  }

  async function deleteNotif(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setNotifications(prev => prev.filter(n => n.id !== id))
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  // Touch swipe handlers
  function onTouchStart(id: string, e: React.TouchEvent) {
    touchStartX.current[id] = e.touches[0].clientX
  }
  function onTouchMove(id: string, e: React.TouchEvent) {
    const dx = e.touches[0].clientX - (touchStartX.current[id] || 0)
    if (dx < 0) setSwipeX(prev => ({ ...prev, [id]: Math.max(dx, -80) }))
  }
  function onTouchEnd(id: string) {
    const dx = swipeX[id] || 0
    if (dx < -60) {
      // Delete on full swipe
      setNotifications(prev => prev.filter(n => n.id !== id))
      fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    }
    setSwipeX(prev => ({ ...prev, [id]: 0 }))
  }

  return (
    <header className="topbar">
      <button onClick={toggle} className="hamburger items-center justify-center w-9 h-9 rounded-lg cursor-pointer border-none bg-transparent" style={{ color: '#18181B' }}>
        <Menu size={20} />
      </button>
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifs(!showNotifs); setShowAll(false) }}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer border-none bg-transparent hover:bg-black/10 transition-colors"
            style={{ color: '#18181B' }}
          >
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full bg-red-500">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div
              className="dropdown"
              style={{
                position: 'fixed',
                top: 'calc(var(--topbar-height) + 0.5rem)',
                left: '0.75rem',
                right: '0.75rem',
                width: 'auto',
                maxWidth: '22rem',
                marginLeft: 'auto',
                maxHeight: 'min(22rem, calc(100vh - var(--topbar-height) - 2rem))',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              {/* Header */}
              <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Notifikasi {notifications.length > 0 && <span style={{ color: 'var(--accent-secondary)' }} className="font-bold">({notifications.length})</span>}
                </span>
                {unread > 0 && (
                  <button
                    onClick={async () => {
                      await Promise.all(notifications.filter(n => !n.read).map(n =>
                        fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
                      ))
                      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                    }}
                    className="text-xs font-medium cursor-pointer border-none bg-transparent hover:underline"
                    style={{ color: 'var(--accent-secondary)' }}
                  >
                    Tandai semua dibaca
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="p-6 text-sm text-center text-muted">Tidak ada notifikasi</div>
              ) : (
                <>
                  {displayed.map(n => (
                    <div
                      key={n.id}
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onTouchStart={e => onTouchStart(n.id, e)}
                      onTouchMove={e => onTouchMove(n.id, e)}
                      onTouchEnd={() => onTouchEnd(n.id)}
                    >
                      {/* Swipe delete background — only visible during swipe */}
                      {(swipeX[n.id] || 0) < -10 && (
                        <div style={{
                          position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
                          backgroundColor: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <X size={16} color="white" />
                        </div>
                      )}

                      <div
                        onClick={() => handleNotifClick(n)}
                        className="flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: n.read ? 'var(--bg-card)' : 'color-mix(in srgb, var(--accent-secondary) 8%, transparent)',
                          transform: `translateX(${swipeX[n.id] || 0}px)`,
                          transition: (swipeX[n.id] || 0) === 0 ? 'transform 0.2s ease' : 'none',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = n.read ? 'var(--bg-card)' : 'color-mix(in srgb, var(--accent-secondary) 8%, transparent)' }}
                      >
                        {/* Unread dot */}
                        <div style={{ flexShrink: 0, marginTop: '0.375rem' }}>
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%',
                            backgroundColor: n.read ? 'transparent' : 'var(--accent-secondary)',
                          }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary">{n.title}</p>
                          <p className="text-xs mt-0.5 text-muted" style={{ lineHeight: 1.4 }}>{n.message}</p>
                          {n.referenceType && (
                            <p className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--accent-secondary)' }}>Klik untuk buka →</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Show more footer */}
                  {notifications.length > NOTIF_LIMIT && (
                    <div
                      className="px-3 py-2 text-xs font-medium text-center cursor-pointer hover:underline"
                      style={{ color: 'var(--accent-secondary)', borderTop: '1px solid var(--border)' }}
                      onClick={() => setShowAll(prev => !prev)}
                    >
                      {showAll
                        ? 'Tampilkan lebih sedikit ↑'
                        : `Lihat ${notifications.length - NOTIF_LIMIT} notifikasi lainnya ↓`}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          {(() => {
            const displayName = currentUser?.name || session?.user?.name || 'User';
            const displayRole = currentUser?.role || session?.user?.role || '';
            const avatarUrl = currentUser?.avatar;

            return (
              <>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer border-none bg-transparent hover:bg-black/10"
                  style={{ color: '#18181B' }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold bg-zinc-950 overflow-hidden shrink-0 border border-zinc-300">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      (displayName || '?')[0].toUpperCase()
                    )}
                  </div>
                  <span className="text-sm font-semibold hidden sm:block" style={{ color: '#18181B' }}>
                    {displayName}
                  </span>
                </button>
                {showMenu && (
                  <div className="dropdown" style={{ width: '13rem' }}>
                    <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <p className="text-sm font-semibold text-primary truncate">{displayName}</p>
                      <p className="text-xs text-muted mt-0.5">{currentUser?.position || displayRole}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowProfileModal(true);
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold cursor-pointer border-none bg-transparent text-zinc-800 hover:bg-zinc-100 transition-colors"
                    >
                      <Edit3 size={15} className="text-amber-500" /> Edit Profil Saya
                    </button>
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-medium cursor-pointer border-none bg-transparent text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Hidden File Input for Avatar */}
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarUpload}
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
      />

      {/* Modal Edit Profil Saya */}
      {showProfileModal && (
        <div className="apple-modal-overlay">
          <div className="apple-modal-sheet relative" style={{ padding: '0 1.75rem 1.75rem', maxWidth: 460 }}>
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 border-none bg-transparent cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3.5 pb-4 mb-4 border-b border-zinc-100" style={{ paddingTop: '1.25rem' }}>
              {/* Avatar dengan click ganti foto */}
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="relative w-14 h-14 rounded-full shrink-0 cursor-pointer group shadow-sm overflow-hidden border-2 border-zinc-200"
                title="Klik untuk ubah foto profil"
              >
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-900 text-white font-bold text-base flex items-center justify-center">
                    {(currentUser?.name || '?')[0].toUpperCase()}
                  </div>
                )}
                <div
                  className={`absolute inset-0 bg-black/55 text-white flex items-center justify-center transition-opacity ${
                    uploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {uploadingAvatar ? <Loader2 size={18} className="animate-spin text-white" /> : <Camera size={16} />}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-zinc-900 leading-tight">Edit Profil Saya</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Klik foto untuk mengganti avatar profil Anda</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3.5">
              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="Nama Anda"
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  Posisi / Jabatan
                </label>
                <input
                  type="text"
                  value={profilePosition}
                  onChange={e => setProfilePosition(e.target.value)}
                  placeholder="e.g. Web Developer, UI/UX Designer"
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  value={profileLinkedin}
                  onChange={e => setProfileLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  GitHub Profile URL
                </label>
                <input
                  type="url"
                  value={profileGithub}
                  onChange={e => setProfileGithub(e.target.value)}
                  placeholder="https://github.com/username"
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  No. WhatsApp
                </label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={e => setProfilePhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="input text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="btn-secondary text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingProfile || !profileName.trim()}
                  className="btn-primary text-xs"
                >
                  {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
