import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Read role from JWT user_metadata
  const role = user?.user_metadata?.role as string | undefined

  // Auth pages - redirect to dashboard if already logged in
  if (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup')) {
    if (user && role) {
      const target = role === 'teacher' ? '/teacher' : '/student'
      return NextResponse.redirect(new URL(target, request.url), { status: 303 })
    }
    return supabaseResponse
  }

  // Protected routes - require authentication
  if (!user) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl, { status: 303 })
  }

  // Root page - redirect to dashboard based on role
  if (pathname === '/') {
    if (role === 'teacher') {
      return NextResponse.redirect(new URL('/teacher', request.url), { status: 303 })
    }
    if (role === 'student') {
      return NextResponse.redirect(new URL('/student', request.url), { status: 303 })
    }
  }

  // Teacher routes - role check from JWT
  if (pathname.startsWith('/teacher')) {
    if (role !== 'teacher') {
      return NextResponse.redirect(new URL('/student', request.url), { status: 303 })
    }
    return supabaseResponse
  }

  // Student routes - role check from JWT
  if (pathname.startsWith('/student')) {
    if (role !== 'student') {
      return NextResponse.redirect(new URL('/teacher', request.url), { status: 303 })
    }
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
