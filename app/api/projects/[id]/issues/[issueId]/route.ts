import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { formatStatusChanged } from '@/lib/whatsapp'
import { emitSocket } from '@/lib/socket'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { issueId } = await params

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      createdBy: { select: { id: true, name: true, avatar: true } },
      assignedTo: { select: { id: true, name: true, avatar: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, avatar: true, email: true } },
        },
      },
      comments: {
        include: { author: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'asc' },
      },
      activities: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      project: { select: { id: true, name: true } },
    },
  })

  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(issue)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, issueId } = await params
  const body = await req.json()

  const oldIssue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { project: { select: { name: true } }, createdBy: true },
  })
  if (!oldIssue) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, any> = {}
  if (body.status !== undefined) data.status = body.status
  if (body.priority !== undefined) data.priority = body.priority
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description

  // Multi assignees update
  let newAssigneeIds: string[] | null = null
  if (Array.isArray(body.assigneeIds)) {
    newAssigneeIds = body.assigneeIds
    // sync assignedToId with first assignee for backward compatibility
    data.assignedToId = (newAssigneeIds && newAssigneeIds.length > 0) ? newAssigneeIds[0] : null
  } else if (body.assignedToId !== undefined) {
    data.assignedToId = body.assignedToId
    newAssigneeIds = body.assignedToId ? [body.assignedToId] : []
  }

  if (newAssigneeIds !== null) {
    // Replace assignees in DB
    await prisma.issueAssignee.deleteMany({ where: { issueId } })
    if (newAssigneeIds.length > 0) {
      await prisma.issueAssignee.createMany({
        data: newAssigneeIds.map(userId => ({ issueId, userId })),
        skipDuplicates: true,
      })
    }
  }

  const issue = await prisma.issue.update({
    where: { id: issueId },
    data,
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, avatar: true, email: true } },
        },
      },
      project: { select: { id: true, name: true } },
    },
  })

  // Track status change
  if (body.status && body.status !== oldIssue.status) {
    await prisma.issueActivity.create({
      data: {
        issueId,
        userId: session.user.id,
        action: 'STATUS_CHANGED',
        metadata: { oldStatus: oldIssue.status, newStatus: body.status },
      },
    })

    // Notify issue creator about status change
    if (oldIssue.createdById !== session.user.id) {
      const statusLabels: Record<string, string> = {
        OPEN: 'Baru',
        IN_REVIEW: 'Ditinjau',
        IN_PROGRESS: 'Dikerjakan',
        RESOLVED: 'Diselesaikan',
        CLOSED: 'Ditutup',
      }
      const oldLabel = statusLabels[oldIssue.status] || oldIssue.status
      const newLabel = statusLabels[body.status] || body.status

      await createNotification({
        userId: oldIssue.createdById,
        type: 'ISSUE_UPDATED',
        title: 'Status Issue Diperbarui',
        message: `Issue "${oldIssue.title}": ${oldLabel} → ${newLabel}`,
        referenceId: issueId,
        referenceType: 'issue',
        waMessage: formatStatusChanged({
          projectName: oldIssue.project.name,
          issueId,
          issueTitle: oldIssue.title,
          oldStatus: oldIssue.status,
          newStatus: body.status,
          projectId: id,
          appUrl: process.env.APP_URL!,
        }),
      })
    }
  }

  // Track assignment & send notification to all newly assigned developers
  if (newAssigneeIds !== null) {
    const existingAssigneeIds = await prisma.issueAssignee
      .findMany({ where: { issueId }, select: { userId: true } })
      .then(list => list.map(a => a.userId))

    const addedIds = newAssigneeIds.filter(uid => !existingAssigneeIds.includes(uid) && uid !== session.user.id)

    if (addedIds.length > 0) {
      const { formatIssueAssigned } = await import('@/lib/whatsapp')
      for (const devId of addedIds) {
        await prisma.issueActivity.create({
          data: {
            issueId,
            userId: session.user.id,
            action: 'ASSIGNED',
            metadata: { assignedToId: devId },
          },
        }).catch(() => {})

        await createNotification({
          userId: devId,
          type: 'ISSUE_ASSIGNED',
          title: 'Issue Baru Ditugaskan',
          message: `Kamu ditugaskan pada issue: "${oldIssue.title}"`,
          referenceId: issueId,
          referenceType: 'issue',
          waMessage: formatIssueAssigned({
            projectName: oldIssue.project.name,
            issueId,
            issueTitle: oldIssue.title,
            priority: issue.priority,
            projectId: id,
            appUrl: process.env.APP_URL || 'https://teams.belanjamu.company',
          }),
        }).catch(err => console.error('Failed notifying assignee:', err))
      }
    }
  }

  // Realtime Socket broadcast issue update
  emitSocket(`project:${id}`, 'issue:updated', issue)

  return NextResponse.json(issue)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, issueId } = await params

  const existing = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { createdById: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isPMorAdmin = session.user.role === 'ADMIN' || !!(await prisma.projectMember.findFirst({
    where: { projectId: id, userId: session.user.id, role: 'PM' },
  }))

  if (!isPMorAdmin && existing.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Hanya PM atau Admin yang bisa menghapus issue' }, { status: 403 })
  }

  await prisma.issue.delete({ where: { id: issueId } })

  emitSocket(`project:${id}`, 'issue:deleted', { id: issueId })

  return NextResponse.json({ success: true })
}
