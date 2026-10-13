import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where = session.user.role === 'ADMIN'
    ? {}
    : { members: { some: { userId: session.user.id } } }

  const projects = await prisma.project.findMany({
    where,
    include: {
      createdBy: {
        select: { id: true, name: true, role: true, avatar: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, role: true, avatar: true, email: true },
          },
        },
      },
      updates: {
        select: {
          id: true,
          status: true,
          title: true,
          assignedTo: {
            select: { id: true, name: true, role: true, avatar: true },
          },
        },
      },
      _count: {
        select: { issues: true, updates: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Transform into table rows
  const rows = projects.map((p) => {
    // Collect unique contributors (members + update assignees + creator)
    const contributorMap = new Map<string, { id: string; name: string; role: string; src?: string; fallback: string }>()

    if (p.createdBy) {
      contributorMap.set(p.createdBy.id, {
        id: p.createdBy.id,
        name: p.createdBy.name,
        role: p.createdBy.role,
        src: p.createdBy.avatar || undefined,
        fallback: (p.createdBy.name || 'U').slice(0, 2).toUpperCase(),
      })
    }

    p.members.forEach((m) => {
      if (m.user) {
        contributorMap.set(m.user.id, {
          id: m.user.id,
          name: m.user.name,
          role: m.user.role,
          src: m.user.avatar || undefined,
          fallback: (m.user.name || 'U').slice(0, 2).toUpperCase(),
        })
      }
    })

    p.updates.forEach((u) => {
      if (u.assignedTo && !contributorMap.has(u.assignedTo.id)) {
        contributorMap.set(u.assignedTo.id, {
          id: u.assignedTo.id,
          name: u.assignedTo.name,
          role: u.assignedTo.role,
          src: u.assignedTo.avatar || undefined,
          fallback: (u.assignedTo.name || 'U').slice(0, 2).toUpperCase(),
        })
      }
    })

    // Use model fields first, fallback to regex in description
    const desc = p.description || ''
    const urlMatch = desc.match(/https?:\/\/[^\s]+/i)
    const repository = p.repository || (urlMatch ? urlMatch[0] : null)

    let tech = p.techStack || ''
    if (!tech) {
      const techMatches = desc.match(/\b(React|Next\.js|Vue|Node\.js|Laravel|Python|Flutter|TypeScript|Tailwind)\b/i)
      tech = techMatches ? techMatches[0] : 'Next.js'
    }

    // Map status enum to variant
    let variant: 'active' | 'inProgress' | 'onHold' = 'active'
    let text = 'Active'

    if (p.status === 'ACTIVE') {
      variant = 'active'
      text = 'Active'
    } else if (p.status === 'ON_HOLD' || p.status === 'ARCHIVED') {
      variant = 'onHold'
      text = p.status === 'ARCHIVED' ? 'Archived' : 'On Hold'
    } else if (p.status === 'COMPLETED') {
      variant = 'active'
      text = 'Completed'
    } else {
      variant = 'inProgress'
      text = 'Progress'
    }

    // Format created date
    const createdAt = new Date(p.createdAt).toISOString().split('T')[0]

    // Determine team label
    const devCount = Array.from(contributorMap.values()).filter(c => c.role === 'DEVELOPER' || c.role === 'ADMIN').length
    const team = devCount > 0 ? `${devCount} Developer${devCount > 1 ? 's' : ''}` : 'General Team'

    return {
      id: p.id,
      name: p.name,
      repository,
      team,
      tech,
      createdAt,
      contributors: Array.from(contributorMap.values()),
      status: {
        text,
        variant,
      },
    }
  })

  return NextResponse.json(rows)
}
