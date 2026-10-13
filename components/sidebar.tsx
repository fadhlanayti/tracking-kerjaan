'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  UserPlus,
  X,
  ChevronDown,
  GitPullRequest,
  ListFilter,
  Plus,
  Sparkles
} from 'lucide-react'
import { useSidebar } from './providers'

interface SubMenuItem {
  href: string
  label: string
  icon?: React.ElementType
}

interface NavItemConfig {
  id: string
  label: string
  icon: React.ElementType
  href?: string
  roles: string[]
  children?: SubMenuItem[]
}

const navConfig: NavItemConfig[] = [
  {
    id: 'dashboard',
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'DEVELOPER', 'CLIENT'],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderKanban,
    roles: ['ADMIN', 'DEVELOPER', 'CLIENT'],
    children: [
      { href: '/projects', label: 'All Projects', icon: ListFilter },
      { href: '/projects/contributors', label: 'Project & Contributor', icon: GitPullRequest },
      { href: '/projects/new', label: 'New Project', icon: Plus },
    ],
  },
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    roles: ['ADMIN'],
    children: [
      { href: '/users', label: 'All Users', icon: Users },
      { href: '/users/invite', label: 'Invite User', icon: UserPlus },
    ],
  },
  {
    id: 'teams',
    href: '/teams',
    label: 'Weball Teams',
    icon: Sparkles,
    roles: ['ADMIN', 'DEVELOPER', 'CLIENT'],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { open, toggle } = useSidebar()
  const role = session?.user?.role || 'CLIENT'

  // Accordion state
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    projects: true,
    users: true,
  })

  // Auto-expand accordion based on active path
  useEffect(() => {
    if (pathname.startsWith('/projects')) {
      setOpenMenus(prev => ({ ...prev, projects: true }))
    }
    if (pathname.startsWith('/users')) {
      setOpenMenus(prev => ({ ...prev, users: true }))
    }
  }, [pathname])

  const toggleAccordion = (id: string) => {
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const isChildActive = (href: string) => {
    if (href === '/projects') return pathname === '/projects'
    if (href === '/users') return pathname === '/users'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const isParentActive = (item: NavItemConfig) => {
    if (item.href) return pathname === item.href
    if (item.children) {
      return item.children.some(child => isChildActive(child.href))
    }
    return false
  }

  return (
    <>
      <div className={`sidebar-overlay${open ? ' show' : ''}`} onClick={toggle} />

      <aside className={`sidebar${open ? ' open' : ''}`}>
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-950 text-xs font-bold shrink-0 bg-accent">W</div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight">WeballCreative</h1>
              <p className="text-[11px] leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>Project Tracker</p>
            </div>
          </div>
          <button onClick={toggle} className="hamburger items-center justify-center w-7 h-7 rounded-lg cursor-pointer border-none bg-transparent" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto">
          {navConfig.filter(item => item.roles.includes(role)).map(item => {
            const hasChildren = !!item.children && item.children.length > 0
            const isOpen = !!openMenus[item.id]
            const parentActive = isParentActive(item)

            if (!hasChildren && item.href) {
              const active = pathname === item.href
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => { if (window.innerWidth < 768) toggle() }}
                  className={`nav-sidebar${active ? ' active' : ''}`}
                >
                  <item.icon size={17} />
                  <span>{item.label}</span>
                </Link>
              )
            }

            return (
              <div key={item.id} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleAccordion(item.id)}
                  className={`nav-sidebar w-full justify-between cursor-pointer border-none bg-transparent text-left ${
                    parentActive && !isOpen ? 'text-white' : ''
                  }`}
                  style={{
                    backgroundColor: parentActive && !isOpen ? 'rgba(255, 207, 82, 0.15)' : 'transparent',
                    color: parentActive && !isOpen ? 'var(--accent)' : undefined,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={17} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 transition-transform duration-200 text-zinc-400 ${
                      isOpen ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>

                {/* Submenu Accordion */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="overflow-hidden flex flex-col gap-0.5 ml-4 pl-3.5 my-1 border-l border-white/10">
                    {item.children?.map(sub => {
                      const active = isChildActive(sub.href)
                      const SubIcon = sub.icon

                      // Filter out 'New Project' for non-ADMIN
                      if (sub.href === '/projects/new' && role !== 'ADMIN') {
                        return null
                      }

                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => { if (window.innerWidth < 768) toggle() }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all no-underline ${
                            active
                              ? 'bg-accent text-zinc-950 font-semibold shadow-xs'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {SubIcon && <SubIcon size={14} className={active ? 'text-zinc-950' : 'text-zinc-400'} />}
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* User info */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-950 text-xs font-semibold shrink-0 bg-accent">
              {(session?.user?.name || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{session?.user?.name}</p>
              <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{session?.user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
