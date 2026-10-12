import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import crypto from 'crypto'
import { uploadToR2 } from '@/lib/r2'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 })
  }

  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/zip', 'video/mp4', 'video/webm'
  ]
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = extname(file.name) || '.bin'
  const filename = `${crypto.randomUUID()}${ext}`

  // 1. Try Cloudflare R2 if configured
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  ) {
    try {
      const r2Url = await uploadToR2(buffer, file.name, file.type)
      return NextResponse.json({ url: r2Url })
    } catch (r2Err) {
      console.error('R2 upload failed, falling back to local disk:', r2Err)
    }
  }

  // 2. Fallback to local public/uploads directory
  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(join(UPLOAD_DIR, filename), buffer)

  const url = `/uploads/${filename}`
  return NextResponse.json({ url })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { url } = await req.json()
    if (!url || !url.startsWith('/uploads/')) return NextResponse.json({ success: false })

    const { unlink } = await import('fs/promises')
    const filepath = join(process.cwd(), 'public', url)
    await unlink(filepath).catch(() => {})
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
