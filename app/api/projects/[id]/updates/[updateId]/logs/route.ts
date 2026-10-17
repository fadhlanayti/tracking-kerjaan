import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitSocket } from '@/lib/socket'
import { notifyMentions } from '@/lib/mentions'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, updateId } = await params
  const user = session.user

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId: user.id } },
  })

  const isDevOrAdmin =
    user.role === 'ADMIN' ||
    user.role === 'DEVELOPER' ||
    member?.role === 'DEVELOPER' ||
    member?.role === 'PM'

  if (!isDevOrAdmin) {
    return NextResponse.json({ error: 'Hanya Developer, PM atau Admin yang dapat menambahkan log update' }, { status: 403 })
  }

  const body = await req.json()
  const { content, notes, status, attachments } = body

  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'Keterangan log progres wajib diisi' }, { status: 400 })
  }

  // Create log
  const log = await prisma.projectUpdateLog.create({
    data: {
      projectUpdateId: updateId,
      authorId: user.id,
      content: content.trim(),
      notes: notes?.trim() || null,
      status: status || null,
      attachments: Array.isArray(attachments) ? attachments : [],
    },
    include: {
      author: { select: { id: true, name: true, role: true, avatar: true } },
    },
  })

  // Optional: update parent status if provided
  if (status) {
    await prisma.projectUpdate.update({
      where: { id: updateId },
      data: { status },
    })
  }

  // Get fresh update data with all logs & issues for broadcast
  const updatedParent = await prisma.projectUpdate.findUnique({
    where: { id: updateId },
    include: {
      author: { select: { id: true, name: true, role: true, avatar: true } },
      assignedTo: { select: { id: true, name: true, role: true, avatar: true } },
      timelineLogs: {
        include: {
          author: { select: { id: true, name: true, role: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      issues: {
        select: { id: true, title: true, status: true, priority: true, createdAt: true },
      },
    },
  })

  emitSocket(`project:${id}`, 'project:update:status', updatedParent)
  emitSocket(`project:${id}`, 'project:update:log', { updateId, log })

  // @mention notifications
  notifyMentions({
    content: content.trim(),
    projectId: id,
    authorId: user.id,
    authorName: user.name || 'User',
    refType: 'update_log',
    refId: updateId,
    refTitle: updatedParent?.title,
    refUrl: `${process.env.APP_URL}/projects/${id}`,
  }).catch(() => {})

  return NextResponse.json({ log, update: updatedParent }, { status: 201 })
}
