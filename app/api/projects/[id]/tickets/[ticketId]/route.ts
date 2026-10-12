import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticketId } = await params
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { createdBy: { select: { id: true, name: true, role: true, avatar: true } } },
  })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(ticket)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ticketId } = await params
  const body = await req.json()

  const existing = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { createdBy: { select: { id: true, name: true } }, project: { select: { name: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const user = session.user
  const isPMorAdmin = user.role === 'ADMIN' || await prisma.projectMember.findFirst({
    where: { projectId: id, userId: user.id, role: 'PM' },
  })

  // PM/Admin can change status & pmNotes; creator can edit title/description/type if still PENDING
  const isCreator = existing.createdById === user.id
  const data: any = {}

  if (body.status !== undefined) {
    if (!isPMorAdmin) return NextResponse.json({ error: 'Hanya PM atau Admin yang bisa mengubah status ticket' }, { status: 403 })
    data.status = body.status
  }
  if (body.pmNotes !== undefined) {
    if (!isPMorAdmin) return NextResponse.json({ error: 'Hanya PM atau Admin yang bisa memberi catatan' }, { status: 403 })
    data.pmNotes = body.pmNotes
  }
  if (body.title !== undefined && isCreator && existing.status === 'PENDING') data.title = body.title.trim()
  if (body.description !== undefined && isCreator && existing.status === 'PENDING') data.description = body.description
  if (body.type !== undefined && isCreator && existing.status === 'PENDING') data.type = body.type

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data,
    include: { createdBy: { select: { id: true, name: true, role: true, avatar: true } } },
  })

  // Notify creator about status change
  if (body.status && body.status !== existing.status && existing.createdById !== user.id) {
    const statusLabel: Record<string, string> = {
      APPROVED: '✅ Disetujui',
      REJECTED: '❌ Ditolak',
      REVISION: '✏️ Perlu Revisi',
      PENDING: 'Pending',
    }
    await createNotification({
      userId: existing.createdById,
      type: 'TICKET_STATUS',
      title: `Ticket ${statusLabel[body.status] || body.status}`,
      message: `Ticket "${existing.title}" ${statusLabel[body.status] || body.status}${body.pmNotes ? `: ${body.pmNotes}` : ''} — ${existing.project.name}`,
      referenceId: ticketId,
      referenceType: 'ticket',
    })
  }

  if ((globalThis as any).__io) {
    (globalThis as any).__io.to(`project:${id}`).emit('ticket:updated', ticket)
  }

  return NextResponse.json(ticket)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ticketId } = await params
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isPMorAdmin = session.user.role === 'ADMIN' || await prisma.projectMember.findFirst({
    where: { projectId: id, userId: session.user.id, role: 'PM' },
  })
  if (existing.createdById !== session.user.id && !isPMorAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.ticket.delete({ where: { id: ticketId } })

  if ((globalThis as any).__io) {
    (globalThis as any).__io.to(`project:${id}`).emit('ticket:deleted', { id: ticketId })
  }

  return NextResponse.json({ success: true })
}
