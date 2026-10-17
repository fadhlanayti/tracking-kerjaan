import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitSocket } from '@/lib/socket'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticketId } = await params

  const comments = await (prisma as any).ticketComment.findMany({
    where: { ticketId },
    include: {
      author: { select: { id: true, name: true, avatar: true, role: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(comments)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ticketId } = await params
  const { content, attachments } = await req.json()
  if (!content?.trim() && (!attachments || attachments.length === 0)) {
    return NextResponse.json({ error: 'Pesan atau lampiran diperlukan' }, { status: 400 })
  }

  const comment = await (prisma as any).ticketComment.create({
    data: {
      ticketId,
      authorId: session.user.id,
      content: content?.trim() || '',
      attachments: Array.isArray(attachments) ? attachments : [],
    },
    include: {
      author: { select: { id: true, name: true, avatar: true, role: true } },
    },
  })

  // Auto IN_PROGRESS: jika tiket masih OPEN dan ada comment pertama dari member
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { status: true },
  })
  if (ticket?.status === 'OPEN') {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'IN_PROGRESS' },
    })
    emitSocket(`project:${id}`, 'ticket:updated', { id: ticketId, status: 'IN_PROGRESS' })
  }

  emitSocket(`project:${id}`, 'ticket-comment:new', { ticketId, comment })

  return NextResponse.json(comment, { status: 201 })
}
