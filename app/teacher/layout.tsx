import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import NavLink from '@/components/NavLink'
import type { Database } from '@/lib/supabase/database.types'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const typedProfile = profile as Database['public']['Tables']['profiles']['Row'] | null
  if (!typedProfile) {
    // Profile was deleted (e.g. DB wipe) - sign out
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/auth/login')
  }
  if (typedProfile.role !== 'teacher') {
    redirect('/student')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/teacher" className="text-xl font-bold text-gray-900">
              GCSE CS Tutor
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              <div className="px-3 py-2">
                <NavLink href="/teacher" exact>Dashboard</NavLink>
              </div>
              <div className="px-3 py-2">
                <NavLink href="/teacher/topics">Topics</NavLink>
              </div>
            </nav>
            {/* Mobile nav */}
            <nav className="flex sm:hidden items-center gap-3">
              <Link href="/teacher" className="text-sm font-medium text-gray-600 hover:text-gray-900">D</Link>
              <Link href="/teacher/topics" className="text-sm font-medium text-gray-600 hover:text-gray-900">T</Link>
            </nav>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
