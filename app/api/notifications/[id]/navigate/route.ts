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
  const notif = await prisma.notification.findUnique({
    where: { id, userId: session.user.id },
  })

  if (!notif || !notif.referenceId || !notif.referenceType) {
    return NextResponse.json({ url: null })
  }

  let url: string | null = null

  switch (notif.referenceType) {
    case 'ticket':
    case 'ticket_comment': {
      const ticket = await prisma.ticket.findUnique({
        where: { id: notif.referenceId },
        select: { projectId: true, status: true },
      })
      if (ticket) {
        const inWork = ['OPEN', 'IN_PROGRESS', 'DONE'].includes(ticket.status)
        url = inWork
          ? `/projects/${ticket.projectId}/tickets/${notif.referenceId}`
          : `/projects/${ticket.projectId}/tickets`
      }
      break
    }
    case 'issue':
    case 'issue_comment': {
      const issue = await prisma.issue.findUnique({
        where: { id: notif.referenceId },
        select: { projectId: true },
      })
      if (issue) url = `/projects/${issue.projectId}/issues/${notif.referenceId}`
      break
    }
    case 'chat': {
      // referenceId = messageId — cari channel-nya
      const msg = await (prisma as any).chatMessage.findUnique({
        where: { id: notif.referenceId },
        include: { channel: { select: { projectId: true } } },
      })
      if (msg?.channel) url = `/projects/${msg.channel.projectId}/chat`
      break
    }
    case 'update_log': {
      const log = await (prisma as any).projectUpdateLog.findUnique({
        where: { id: notif.referenceId },
        include: { projectUpdate: { select: { projectId: true } } },
      })
      if (log?.projectUpdate) url = `/projects/${log.projectUpdate.projectId}`
      break
    }
    case 'project': {
      url = `/projects/${notif.referenceId}`
      break
    }
  }

  return NextResponse.json({ url })
}
