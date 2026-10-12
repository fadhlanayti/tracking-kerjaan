import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const priority = url.searchParams.get('priority')
  const assignedToId = url.searchParams.get('assignedToId')

  const where: any = { projectId: id }
  if (status) where.status = status
  if (priority) where.priority = priority
  if (assignedToId) where.assignedToId = assignedToId

  // Developer only sees assigned issues
  if (session.user.role === 'DEVELOPER') {
    where.assignedToId = session.user.id
  }

  const issues = await prisma.issue.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true, avatar: true } },
      assignedTo: { select: { id: true, name: true, avatar: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(issues)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { title, description, priority, attachments, projectUpdateId } = await req.json()
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  // Hanya PM/Admin yang bisa buat issue
  // Developer & Client tidak bisa — Client lewat ticket, Developer hanya bisa bikin progress update
  const isPMorAdmin = session.user.role === 'ADMIN' || !!(await prisma.projectMember.findFirst({
    where: { projectId: id, userId: session.user.id, role: 'PM' },
  }))
  if (!isPMorAdmin) {
    return NextResponse.json({ error: 'Hanya PM atau Admin yang bisa membuat issue' }, { status: 403 })
  }

  const issue = await prisma.issue.create({
    data: {
      projectId: id,
      title,
      description: description || null,
      priority: priority || 'MEDIUM',
      attachments: attachments || [],
      createdById: session.user.id,
      projectUpdateId: projectUpdateId || null,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  })

  // Create activity
  await prisma.issueActivity.create({
    data: {
      issueId: issue.id,
      userId: session.user.id,
      action: 'CREATED',
    },
  })

  // Emit realtime event
  if ((globalThis as any).__io) {
    (globalThis as any).__io.to(`project:${id}`).emit('issue:new', issue)
  }

  return NextResponse.json(issue, { status: 201 })
}
