import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // Fix redirect loop behind nginx reverse proxy:
  // When accessed via HTTPS reverse proxy, Next.js internal redirects must target https://
  const proto = request.headers.get('x-forwarded-proto')
  if (proto === 'https' && request.nextUrl.protocol === 'http:') {
    const url = request.nextUrl.clone()
    url.protocol = 'https:'
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/).*)'],
}
