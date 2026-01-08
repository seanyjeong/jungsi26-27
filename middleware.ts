import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDeviceType } from '@/lib/device'

export async function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || ''
  const deviceType = getDeviceType(userAgent)
  
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-device-type', deviceType)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
