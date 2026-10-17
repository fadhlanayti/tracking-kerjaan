import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { formatNewComment } from '@/lib/whatsapp'
import { notifyMentions } from '@/lib/mentions'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, issueId } = await params
  const { content, attachments } = await req.json()
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const comment = await prisma.issueComment.create({
    data: {
      issueId,
      authorId: session.user.id,
      content,
      attachments: attachments || [],
    },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
    },
  })

  await prisma.issueActivity.create({
    data: {
      issueId,
      userId: session.user.id,
      action: 'COMMENTED',
    },
  })

  // Notify stakeholders
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { project: { select: { name: true } } },
  })

  if (issue) {
    const notifyUserIds = new Set<string>()
    if (issue.createdById !== session.user.id) notifyUserIds.add(issue.createdById)
    if (issue.assignedToId && issue.assignedToId !== session.user.id) notifyUserIds.add(issue.assignedToId)

    for (const uid of notifyUserIds) {
      await createNotification({
        userId: uid,
        type: 'NEW_COMMENT',
        title: 'New Comment',
        message: `${session.user.name} commented on: ${issue.title}`,
        referenceId: issueId,
        referenceType: 'issue',
        waMessage: formatNewComment({
          authorName: session.user.name || 'User',
          issueId,
          issueTitle: issue.title,
          commentPreview: content.substring(0, 100),
          projectId: id,
          appUrl: process.env.APP_URL!,
        }),
      })
    }
  }

  // @mention notifications
  notifyMentions({
    content,
    projectId: id,
    authorId: session.user.id,
    authorName: session.user.name || 'User',
    refType: 'issue_comment',
    refId: issueId,
    refTitle: issue?.title,
    refUrl: `${process.env.APP_URL}/projects/${id}/issues/${issueId}`,
  }).catch(() => {})

  return NextResponse.json(comment, { status: 201 })
}
