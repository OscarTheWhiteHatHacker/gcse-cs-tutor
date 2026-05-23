import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

function redirectWithCookies(url: string, supabaseResponse: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(new URL(url, supabaseResponse.url), { status: 303 })
  // Preserve auth cookies from supabaseResponse so the browser has them after the redirect
  const cookies = supabaseResponse.cookies.getAll()
  for (const cookie of cookies) {
    // @ts-expect-error - cookies API varies between Next.js versions
    redirect.cookies.set(cookie.name, cookie.value, cookie.attributes ?? {})
  }
  return redirect
}

function redirectToLogin(request: NextRequest, supabaseResponse: NextResponse): NextResponse {
  const redirectUrl = new URL('/auth/login', request.url)
  redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
  const redirect = NextResponse.redirect(redirectUrl, { status: 303 })
  const cookies = supabaseResponse.cookies.getAll()
  for (const cookie of cookies) {
    // @ts-expect-error - cookies API varies between Next.js versions
    redirect.cookies.set(cookie.name, cookie.value, cookie.attributes ?? {})
  }
  return redirect
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Read role from JWT user_metadata instead of querying DB
  const role = user?.user_metadata?.role as string | undefined

  // Auth pages - redirect to dashboard if already logged in
  if (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup')) {
    if (user && role) {
      const target = role === 'teacher' ? '/teacher' : '/student'
      return redirectWithCookies(target, supabaseResponse)
    }
    return supabaseResponse
  }

  // Protected routes - require authentication
  if (!user) {
    return redirectToLogin(request, supabaseResponse)
  }

  // Root page - redirect to dashboard based on role
  if (pathname === '/') {
    if (role === 'teacher') {
      return redirectWithCookies('/teacher', supabaseResponse)
    }
    if (role === 'student') {
      return redirectWithCookies('/student', supabaseResponse)
    }
  }

  // Teacher routes - role check from JWT
  if (pathname.startsWith('/teacher')) {
    if (role !== 'teacher') {
      return redirectWithCookies('/student', supabaseResponse)
    }
    return supabaseResponse
  }

  // Student routes - role check from JWT
  if (pathname.startsWith('/student')) {
    if (role !== 'student') {
      return redirectWithCookies('/teacher', supabaseResponse)
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
