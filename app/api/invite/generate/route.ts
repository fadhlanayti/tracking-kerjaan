import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/whatsapp'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { email, name, role, phone, position } = await req.json()
  if (!email || !name || !role) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const normalizedPhone = phone ? normalizePhone(phone) : null

  const inviteToken = crypto.randomUUID()
  const inviteExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const user = await prisma.user.create({
    data: {
      email,
      name,
      phone: normalizedPhone,
      position: position || null,
      role,
      password: '', // Will be set on claim
      inviteToken,
      inviteExpiry,
      isActive: false,
    },
  })

  const inviteUrl = `${process.env.APP_URL}/invite/${inviteToken}`

  // Send WA invite if phone provided
  if (normalizedPhone) {
    const { sendWhatsApp, formatInvite } = await import('@/lib/whatsapp')
    await sendWhatsApp(normalizedPhone, formatInvite(inviteUrl))
  }

  return NextResponse.json({ inviteUrl, userId: user.id })
}
