import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { emitSocket } from '@/lib/socket'

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

  // PM/Admin can change status & pmNotes; creator can edit title/description/type/attachments if PENDING or REVISION
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

  const canCreatorEdit = isCreator && (existing.status === 'PENDING' || existing.status === 'REVISION')
  if (body.title !== undefined && canCreatorEdit) data.title = body.title.trim()
  if (body.description !== undefined && canCreatorEdit) data.description = body.description
  if (body.type !== undefined && canCreatorEdit) data.type = body.type
  if (body.attachments !== undefined && canCreatorEdit && Array.isArray(body.attachments)) data.attachments = body.attachments
  // Check if ticket was in REVISION and now updated by creator
  const isRevisedByCreator = isCreator && existing.status === 'REVISION' && (body.title || body.description || body.attachments || body.type)
  if (isRevisedByCreator) {
    data.status = 'PENDING'
  }

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data,
    include: { createdBy: { select: { id: true, name: true, role: true, avatar: true } } },
  })

  // Notify PM and Admin when creator updates a REVISION ticket
  if (isRevisedByCreator) {
    const pmMembers = await prisma.projectMember.findMany({
      where: { projectId: id, role: 'PM' },
      select: { userId: true },
    })
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    })
    const notifyIds = new Set([...pmMembers.map(m => m.userId), ...admins.map(a => a.id)])
    notifyIds.delete(user.id)

    const revisedTitle = data.title || existing.title
    const revisedType = data.type || existing.type

    for (const targetUserId of notifyIds) {
      await createNotification({
        userId: targetUserId,
        type: 'TICKET_STATUS',
        title: 'Ticket Selesai Direvisi',
        message: `${user.name || 'User'} telah merevisi ticket "${revisedTitle}" di proyek ${existing.project.name}`,
        referenceId: ticketId,
        referenceType: 'ticket',
        waMessage: (await import('@/lib/whatsapp')).formatTicketRevised({
          creatorName: user.name || 'User',
          projectName: existing.project.name,
          ticketTitle: revisedTitle,
          ticketType: revisedType,
          projectId: id,
          appUrl: process.env.APP_URL || '',
        }),
      })
    }
  }

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
      message: `Ticket "${existing.title}" ${statusLabel[body.status] || body.status}${body.pmNotes ? `: ${body.pmNotes}` : ''} di ${existing.project.name}`,
      referenceId: ticketId,
      referenceType: 'ticket',
      waMessage: (await import('@/lib/whatsapp')).formatTicketStatus({
        status: body.status,
        ticketTitle: existing.title,
        projectName: existing.project.name,
        pmNotes: body.pmNotes,
        projectId: id,
        appUrl: process.env.APP_URL || '',
      }),
    })
  }

  emitSocket(`project:${id}`, 'ticket:updated', ticket)

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

  emitSocket(`project:${id}`, 'ticket:deleted', { id: ticketId })

  return NextResponse.json({ success: true })
}
