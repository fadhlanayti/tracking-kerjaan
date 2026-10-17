import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { emitSocket } from '@/lib/socket'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  const member = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: session.user.id },
  })
  const isPMorAdmin = session.user.role === 'ADMIN' || member?.role === 'PM'
  const isDeveloper = session.user.role === 'DEVELOPER' || member?.role === 'DEVELOPER'

  const where: any = { projectId: id }

  // Developer hanya melihat tiket yang sudah APPROVED oleh PM
  if (isDeveloper && !isPMorAdmin) {
    where.status = 'APPROVED'
  } else if (status) {
    where.status = status
  }

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

  // PM, Admin, dan Developer tidak membuat tiket request — hanya Klien
  const member = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: session.user.id },
  })
  const isPMorAdmin = session.user.role === 'ADMIN' || member?.role === 'PM'
  if (isPMorAdmin) {
    return NextResponse.json({ error: 'PM dan Admin hanya meninjau tiket, tidak membuat tiket request.' }, { status: 403 })
  }
  const isDev = session.user.role === 'DEVELOPER' || member?.role === 'DEVELOPER'
  if (isDev) {
    return NextResponse.json({ error: 'Developer dapat mencatat pekerjaan langsung di menu Issues.' }, { status: 403 })
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
      waMessage: (await import('@/lib/whatsapp')).formatTicketNew({
        creatorName: session.user.name || 'User',
        projectName: project?.name || '',
        ticketTitle: title.trim(),
        ticketType: type || 'OTHER',
        projectId: id,
        appUrl: process.env.APP_URL || '',
      }),
    })
  }

  // Emit realtime
  emitSocket(`project:${id}`, 'ticket:new', ticket)

  return NextResponse.json(ticket, { status: 201 })
}
