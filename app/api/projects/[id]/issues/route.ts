import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitSocket } from '@/lib/socket'
import { createNotification } from '@/lib/notifications'
import { formatIssueAssigned } from '@/lib/whatsapp'

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

  if (assignedToId) {
    where.OR = [
      { assignedToId },
      { assignees: { some: { userId: assignedToId } } },
    ]
  }

  // Developer only sees assigned issues
  if (session.user.role === 'DEVELOPER') {
    where.OR = [
      { assignedToId: session.user.id },
      { assignees: { some: { userId: session.user.id } } },
    ]
  }

  const issues = await prisma.issue.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true, avatar: true } },
      assignedTo: { select: { id: true, name: true, avatar: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      },
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
  const { title, description, priority, attachments, projectUpdateId, assigneeIds } = await req.json()
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  // Hanya PM/Admin yang bisa buat issue
  // Developer & Client tidak bisa — Client lewat ticket, Developer hanya bisa bikin progress update
  const isPMorAdmin = session.user.role === 'ADMIN' || !!(await prisma.projectMember.findFirst({
    where: { projectId: id, userId: session.user.id, role: 'PM' },
  }))
  if (!isPMorAdmin) {
    return NextResponse.json({ error: 'Hanya PM atau Admin yang bisa membuat issue' }, { status: 403 })
  }

  const validAssigneeIds: string[] = Array.isArray(assigneeIds) ? assigneeIds : []

  const issue = await prisma.issue.create({
    data: {
      projectId: id,
      title,
      description: description || null,
      priority: priority || 'MEDIUM',
      attachments: attachments || [],
      createdById: session.user.id,
      assignedToId: validAssigneeIds[0] || null,
      projectUpdateId: projectUpdateId || null,
      assignees: validAssigneeIds.length > 0 ? {
        create: validAssigneeIds.map(userId => ({ userId }))
      } : undefined,
    },
    include: {
      createdBy: { select: { id: true, name: true, avatar: true } },
      assignedTo: { select: { id: true, name: true, avatar: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      },
      project: { select: { name: true } },
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

  // Notify assigned developers immediately via web & WA
  if (validAssigneeIds.length > 0) {
    const appUrl = process.env.APP_URL || 'https://teams.belanjamu.company'
    for (const devId of validAssigneeIds) {
      if (devId !== session.user.id) {
        await createNotification({
          userId: devId,
          type: 'ISSUE_ASSIGNED',
          title: 'Issue Baru Ditugaskan',
          message: `Kamu ditugaskan pada issue: "${issue.title}"`,
          referenceId: issue.id,
          referenceType: 'issue',
          waMessage: formatIssueAssigned({
            projectName: issue.project?.name || 'Project',
            issueId: issue.id,
            issueTitle: issue.title,
            priority: issue.priority,
            projectId: id,
            appUrl,
          }),
        }).catch(err => console.error('Failed notifying assignee on create:', err))
      }
    }
  }

  // Emit realtime event
  emitSocket(`project:${id}`, 'issue:new', issue)

  return NextResponse.json(issue, { status: 201 })
}
