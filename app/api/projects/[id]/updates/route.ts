import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitSocket } from '@/lib/socket'
import { createNotification } from '@/lib/notifications'
import { formatProjectUpdate } from '@/lib/whatsapp'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const updates = await prisma.projectUpdate.findMany({
    where: { projectId: id },
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
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(updates)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const user = session.user

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId: user.id } },
  })

  const isDevOrAdmin = user.role === 'ADMIN' || user.role === 'DEVELOPER' || member?.role === 'DEVELOPER' || member?.role === 'PM'
  if (!isDevOrAdmin) {
    return NextResponse.json({ error: 'Hanya Developer atau PM/Admin yang bisa memposting update progress' }, { status: 403 })
  }

  const body = await req.json()
  const { title, content, notes, attachments, assignedToId, status } = body

  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Judul fitur/update wajib diisi' }, { status: 400 })
  }

  const update = await prisma.projectUpdate.create({
    data: {
      projectId: id,
      authorId: user.id,
      assignedToId: assignedToId || user.id,
      status: status || 'DOING',
      title: title.trim(),
      content: content?.trim() || null,
      notes: notes?.trim() || null,
      attachments: Array.isArray(attachments) ? attachments : [],
    },
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

  // Emit realtime event
  emitSocket(`project:${id}`, 'project:update:new', update)

  // Notify all CLIENT members of this project via Web Notification + WhatsApp
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        name: true,
        members: {
          where: { role: 'CLIENT' },
          select: { userId: true },
        },
      },
    })

    if (project && project.members.length > 0) {
      const appUrl = process.env.APP_URL || 'https://teams.belanjamu.company'
      const waMsg = formatProjectUpdate({
        projectName: project.name,
        title: update.title,
        authorName: user.name || 'Tim Developer',
        status: update.status,
        projectId: id,
        appUrl,
      })

      for (const clientMember of project.members) {
        await createNotification({
          userId: clientMember.userId,
          type: 'PROJECT_UPDATED',
          title: 'Update Progress Proyek',
          message: `${project.name}: "${update.title}" (${update.status})`,
          referenceId: id,
          referenceType: 'project',
          waMessage: waMsg,
        }).catch(err => console.error('Failed notifying client:', err))
      }
    }
  } catch (notifErr) {
    console.error('Error in notifying clients for project update:', notifErr)
  }

  return NextResponse.json(update, { status: 201 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { updateId, status, assignedToId, title, content, notes } = await req.json()

  if (!updateId) return NextResponse.json({ error: 'Update ID required' }, { status: 400 })

  const update = await prisma.projectUpdate.update({
    where: { id: updateId },
    data: {
      ...(status ? { status } : {}),
      ...(assignedToId !== undefined ? { assignedToId } : {}),
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(content !== undefined ? { content: content.trim() || null } : {}),
      ...(notes !== undefined ? { notes: notes.trim() || null } : {}),
    },
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

  // Emit realtime event
  emitSocket(`project:${id}`, 'project:update:status', update)

  return NextResponse.json(update)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { updateId } = await req.json()
  if (!updateId) return NextResponse.json({ error: 'Update ID required' }, { status: 400 })

  const user = session.user
  const existing = await prisma.projectUpdate.findUnique({
    where: { id: updateId },
    select: { authorId: true, attachments: true },
  })

  if (!existing) return NextResponse.json({ error: 'Update not found' }, { status: 404 })

  const isAdmin = user.role === 'ADMIN'
  const isAuthor = existing.authorId === user.id
  if (!isAdmin && !isAuthor) {
    return NextResponse.json({ error: 'Hanya author atau admin yang bisa menghapus progress ini' }, { status: 403 })
  }

  await prisma.projectUpdate.delete({ where: { id: updateId } })

  emitSocket(`project:${id}`, 'project:update:delete', { id: updateId })

  return NextResponse.json({ success: true, id: updateId })
}
