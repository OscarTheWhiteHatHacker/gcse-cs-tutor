import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Auth pages - redirect to dashboard if already logged in
  if (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup')) {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'teacher') {
        return NextResponse.redirect(new URL('/teacher', request.url))
      }
      if (profile?.role === 'student') {
        return NextResponse.redirect(new URL('/student', request.url))
      }
    }
    return supabaseResponse
  }

  // Protected routes - require authentication
  if (!user) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Fetch profile for role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Teacher routes - role check
  if (pathname.startsWith('/teacher')) {
    if (!profile || profile.role !== 'teacher') {
      return NextResponse.redirect(new URL('/student', request.url))
    }
    return supabaseResponse
  }

  // Student routes - role check
  if (pathname.startsWith('/student')) {
    if (!profile || profile.role !== 'student') {
      return NextResponse.redirect(new URL('/teacher', request.url))
    }
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
