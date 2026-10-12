import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  zip: 'application/zip',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  // Sanitize filename to prevent directory traversal
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '')
  const filePath = join(process.cwd(), 'public', 'uploads', safeFilename)

  if (!existsSync(filePath)) {
    return new NextResponse('File not found', { status: 404 })
  }

  try {
    const fileBuffer = await readFile(filePath)
    const ext = safeFilename.split('.').pop()?.toLowerCase() || ''
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Error reading file', { status: 500 })
  }
}
