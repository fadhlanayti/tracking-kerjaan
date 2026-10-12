import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitSocket } from '@/lib/socket'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor')
  const take = 50

  const channel = await prisma.chatChannel.findUnique({
    where: { projectId: id },
  })
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  const messages = await prisma.chatMessage.findMany({
    where: { channelId: channel.id },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  return NextResponse.json({
    messages: messages.reverse(),
    nextCursor: messages.length === take ? messages[0]?.id : null,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { content, attachments } = await req.json()
  const trimmedContent = typeof content === 'string' ? content.trim() : ''
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0

  if (!trimmedContent && !hasAttachments) {
    return NextResponse.json({ error: 'Pesan atau lampiran wajib diisi' }, { status: 400 })
  }

  const channel = await prisma.chatChannel.findUnique({
    where: { projectId: id },
  })
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  const message = await prisma.chatMessage.create({
    data: {
      channelId: channel.id,
      senderId: session.user.id,
      content: trimmedContent,
      attachments: hasAttachments ? attachments : [],
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })

  // Broadcast realtime socket to all participants in this project
  emitSocket(`project:${id}`, 'message:new', { ...message, projectId: id })

  return NextResponse.json(message, { status: 201 })
}
