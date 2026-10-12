'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Bell, LogOut, Menu, X } from 'lucide-react'
import { useSidebar } from './providers'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
  referenceId?: string | null
  referenceType?: string | null
}

const NOTIF_LIMIT = 10

export function Topbar() {
  const { data: session } = useSession()
  const { toggle } = useSidebar()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
    return () => clearInterval(t)
  }, [])

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
      <button onClick={toggle} className="hamburger items-center justify-center w-9 h-9 rounded-lg cursor-pointer border-none bg-transparent" style={{ color: 'rgba(255,255,255,0.85)' }}>
        <Menu size={20} />
      </button>
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifs(!showNotifs); setShowAll(false) }}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer border-none bg-transparent"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full bg-accent">
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
                maxHeight: 'min(28rem, calc(100vh - var(--topbar-height) - 2rem))',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              {/* Header */}
              <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Notifikasi {notifications.length > 0 && <span style={{ color: 'var(--accent)' }}>({notifications.length})</span>}
                </span>
                {unread > 0 && (
                  <button
                    onClick={async () => {
                      await Promise.all(notifications.filter(n => !n.read).map(n =>
                        fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
                      ))
                      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                    }}
                    className="text-xs cursor-pointer border-none bg-transparent"
                    style={{ color: 'var(--accent)' }}
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
                      {/* Swipe delete background */}
                      <div style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
                        backgroundColor: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'none',
                      }}>
                        <X size={16} color="white" />
                      </div>

                      <div
                        onClick={() => handleNotifClick(n)}
                        className="flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: n.read ? 'var(--bg-card)' : 'rgba(8,124,240,0.05)',
                          transform: `translateX(${swipeX[n.id] || 0}px)`,
                          transition: (swipeX[n.id] || 0) === 0 ? 'transform 0.2s ease' : 'none',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = n.read ? 'var(--bg-card)' : 'rgba(8,124,240,0.05)' }}
                      >
                        {/* Unread dot */}
                        <div style={{ flexShrink: 0, marginTop: '0.375rem' }}>
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%',
                            backgroundColor: n.read ? 'transparent' : 'var(--accent)',
                          }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary">{n.title}</p>
                          <p className="text-xs mt-0.5 text-muted" style={{ lineHeight: 1.4 }}>{n.message}</p>
                          {n.referenceType && (
                            <p className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--accent)' }}>Klik untuk buka →</p>
                          )}
                        </div>
                        {/* Delete button (desktop) */}
                        <button
                          onClick={e => deleteNotif(e, n.id)}
                          className="shrink-0 p-1 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer border-none bg-transparent text-muted hover:text-red-500"
                          style={{ marginTop: '-0.125rem' }}
                          title="Hapus notifikasi"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Show more footer */}
                  {notifications.length > NOTIF_LIMIT && (
                    <div
                      className="px-3 py-2 text-xs text-center cursor-pointer"
                      style={{ color: 'var(--accent)', borderTop: '1px solid var(--border)' }}
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
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
            style={{ color: 'white' }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium bg-charcoal">
              {(session?.user?.name || '?')[0].toUpperCase()}
            </div>
            <span className="text-sm font-medium hidden sm:block" style={{ color: 'white' }}>{session?.user?.name}</span>
          </button>
          {showMenu && (
            <div className="dropdown" style={{ width: '12rem' }}>
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-sm font-medium text-primary">{session?.user?.name}</p>
                <p className="text-xs text-muted">{session?.user?.role}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm cursor-pointer border-none bg-transparent text-secondary"
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
