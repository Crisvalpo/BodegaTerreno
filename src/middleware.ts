import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const userCookie = request.cookies.get('user')
  const { pathname } = request.nextUrl

  // Si no hay cookie y no está en login, redirigir a login
  if (!userCookie && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si hay cookie y está en login, redirigir al dashboard
  if (userCookie && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

// Configurar qué rutas debe vigilar el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - templates (csv templates)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|templates).*)',
  ],
}
