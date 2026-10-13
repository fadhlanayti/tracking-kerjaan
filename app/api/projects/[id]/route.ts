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

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
      },
      _count: { select: { issues: true } },
    },
  })

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  return NextResponse.json(project)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const user = session.user

  const isPMorAdmin = user.role === 'ADMIN' || !!(await prisma.projectMember.findFirst({
    where: { projectId: id, userId: user.id, role: 'PM' },
  }))

  if (!isPMorAdmin) {
    return NextResponse.json({ error: 'Hanya PM atau Admin yang bisa mengedit project' }, { status: 403 })
  }

  const body = await req.json()
  const data: Record<string, any> = {}

  if (body.name !== undefined) data.name = body.name.trim()
  if (body.description !== undefined) data.description = body.description ? body.description.trim() : null
  if (body.repository !== undefined) data.repository = body.repository ? body.repository.trim() : null
  if (body.techStack !== undefined) data.techStack = body.techStack ? body.techStack.trim() : null
  if (body.status !== undefined) data.status = body.status

  const updated = await prisma.project.update({
    where: { id },
    data,
    include: {
      createdBy: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
      },
      _count: { select: { issues: true } },
    },
  })

  const { emitSocket } = await import('@/lib/socket')
  emitSocket(`project:${id}`, 'project:updated', updated)

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Hanya Admin yang bisa menghapus project' }, { status: 403 })
  }

  const { id } = await params

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: 'Project tidak ditemukan' }, { status: 404 })

  await prisma.project.delete({ where: { id } })

  return NextResponse.json({ success: true, id })
}
