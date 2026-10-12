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
    case 'ticket': {
      const ticket = await prisma.ticket.findUnique({
        where: { id: notif.referenceId },
        select: { projectId: true },
      })
      if (ticket) url = `/projects/${ticket.projectId}/tickets`
      break
    }
    case 'issue': {
      const issue = await prisma.issue.findUnique({
        where: { id: notif.referenceId },
        select: { projectId: true },
      })
      if (issue) url = `/projects/${issue.projectId}/issues/${notif.referenceId}`
      break
    }
    case 'project': {
      url = `/projects/${notif.referenceId}`
      break
    }
  }

  return NextResponse.json({ url })
}
