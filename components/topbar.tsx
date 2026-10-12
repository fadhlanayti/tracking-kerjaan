'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Bell, LogOut, Menu } from 'lucide-react'
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

function getNotifUrl(n: Notification): string | null {
  if (!n.referenceId || !n.referenceType) return null
  switch (n.referenceType) {
    case 'ticket':   return null // need projectId — handled below via stored in message
    case 'issue':    return null // need projectId
    default:         return null
  }
}

export function Topbar() {
  const { data: session } = useSession()
  const { toggle } = useSidebar()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = () => fetch('/api/notifications').then(r => r.json()).then(d => { if (Array.isArray(d)) setNotifications(d) }).catch(() => {})
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notifications.filter(n => !n.read).length

  async function handleNotifClick(n: Notification) {
    // Mark read
    await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    setShowNotifs(false)

    // Navigate based on referenceType
    if (!n.referenceId || !n.referenceType) return

    switch (n.referenceType) {
      case 'ticket': {
        // Extract projectId from notification message via API
        const res = await fetch(`/api/notifications/${n.id}/navigate`)
        if (res.ok) {
          const { url } = await res.json()
          if (url) router.push(url)
        }
        break
      }
      case 'issue': {
        const res = await fetch(`/api/notifications/${n.id}/navigate`)
        if (res.ok) {
          const { url } = await res.json()
          if (url) router.push(url)
        }
        break
      }
    }
  }

  return (
    <header className="topbar">
      {/* Hamburger — hidden on md+ via CSS */}
      <button onClick={toggle} className="hamburger items-center justify-center w-9 h-9 rounded-lg cursor-pointer border-none bg-transparent" style={{ color: 'rgba(255,255,255,0.85)' }}>
        <Menu size={20} />
      </button>
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer border-none bg-transparent"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            <Bell size={19} />
            {unread > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full bg-accent"
              >
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
                maxHeight: 'min(24rem, calc(100vh - var(--topbar-height) - 2rem))',
                overflowY: 'auto',
              }}
            >
              <div className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted" style={{ borderBottom: '1px solid var(--border)' }}>Notifications</div>
              {notifications.length === 0 ? (
                <div className="p-4 text-sm text-center text-muted">No notifications</div>
              ) : notifications.slice(0, 20).map(n => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className="px-3 py-2.5 cursor-pointer transition-colors"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: n.read ? 'transparent' : 'rgba(8,124,240,0.05)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = n.read ? 'transparent' : 'rgba(8,124,240,0.05)' }}
                >
                  <p className="text-sm font-medium text-primary">{n.title}</p>
                  <p className="text-xs mt-0.5 text-muted">{n.message}</p>
                  {n.referenceType && (
                    <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--accent)' }}>Klik untuk buka →</p>
                  )}
                </div>
              ))}
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
