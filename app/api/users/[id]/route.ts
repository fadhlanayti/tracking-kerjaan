import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Users can only edit themselves, admin can edit anyone
  if (session.user.role !== 'ADMIN' && session.user.id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const allowed = ['name', 'phone', 'avatar', 'position', 'linkedin', 'github'] as const
  const data: Record<string, any> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key]
  }

  // Admin-only fields
  if (session.user.role === 'ADMIN') {
    if (body.role !== undefined) data.role = body.role
    if (body.isActive !== undefined) data.isActive = body.isActive
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, phone: true, role: true, avatar: true, position: true, linkedin: true, github: true, isActive: true },
  })

  return NextResponse.json(user)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params

  // Can't delete yourself
  if (session.user.id === id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
  }

  // Hard delete — clear FK refs then delete user in transaction
  await prisma.$transaction([
    // Nullify assignedToId on issues
    prisma.issue.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
    // Delete records with non-cascade FK to user
    prisma.issueComment.deleteMany({ where: { authorId: id } }),
    prisma.issueActivity.deleteMany({ where: { userId: id } }),
    prisma.chatMessage.deleteMany({ where: { senderId: id } }),
    // Cascade-enabled: memberships, notifications auto-deleted
    // Issues created by user — reassign to admin or delete
    prisma.issue.deleteMany({ where: { createdById: id } }),
    // Projects created by user
    prisma.project.deleteMany({ where: { createdById: id } }),
    // Finally delete user
    prisma.user.delete({ where: { id } }),
  ])

  return NextResponse.json({ success: true })
}
