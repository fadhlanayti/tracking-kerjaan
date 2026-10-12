import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  const where: any = { projectId: id }
  if (status) where.status = status

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true, role: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(tickets)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { title, description, type, attachments } = await req.json()

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Judul ticket wajib diisi' }, { status: 400 })
  }

  const ticket = await prisma.ticket.create({
    data: {
      projectId: id,
      createdById: session.user.id,
      title: title.trim(),
      description: description?.trim() || null,
      type: type || 'OTHER',
      attachments: Array.isArray(attachments) ? attachments : [],
    },
    include: {
      createdBy: { select: { id: true, name: true, role: true, avatar: true } },
    },
  })

  // Notify all PMs and Admins in this project
  const pmMembers = await prisma.projectMember.findMany({
    where: { projectId: id, role: 'PM' },
    select: { userId: true },
  })
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })
  const notifyIds = new Set([...pmMembers.map(m => m.userId), ...admins.map(a => a.id)])
  notifyIds.delete(session.user.id)

  const project = await prisma.project.findUnique({ where: { id }, select: { name: true } })

  for (const userId of notifyIds) {
    await createNotification({
      userId,
      type: 'TICKET_NEW',
      title: 'Ticket Baru',
      message: `${session.user.name} membuat ticket: "${title}" di project ${project?.name || ''}`,
      referenceId: ticket.id,
      referenceType: 'ticket',
    })
  }

  // Emit realtime
  if ((globalThis as any).__io) {
    (globalThis as any).__io.to(`project:${id}`).emit('ticket:new', ticket)
  }

  return NextResponse.json(ticket, { status: 201 })
}
