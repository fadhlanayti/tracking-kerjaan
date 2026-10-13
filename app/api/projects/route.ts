import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where = session.user.role === 'ADMIN'
    ? {}
    : { members: { some: { userId: session.user.id } } }

  const projects = await prisma.project.findMany({
    where,
    include: {
      members: { include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
      _count: { select: { issues: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { name, description, repository, techStack, memberIds } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const project = await prisma.project.create({
    data: {
      name,
      description: description || null,
      repository: repository ? repository.trim() : null,
      techStack: techStack ? techStack.trim() : null,
      createdById: session.user.id,
      members: {
        create: [
          { userId: session.user.id, role: 'PM' },
          ...(memberIds || []).map((m: { userId: string; role: string }) => ({
            userId: m.userId,
            role: m.role,
          })),
        ],
      },
      channel: { create: { name: 'General' } },
    },
    include: { members: true, channel: true },
  })

  return NextResponse.json(project, { status: 201 })
}
