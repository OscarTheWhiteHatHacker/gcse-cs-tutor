import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/supabase/database.types'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const typedProfile = profile as Database['public']['Tables']['profiles']['Row'] | null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="mt-1 text-gray-600">
          Welcome back, {typedProfile?.full_name || 'Student'}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">My Topics</h2>
          <p className="mt-2 text-sm text-gray-600">
            Browse released topics and learn at your own pace.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Practice Questions</h2>
          <p className="mt-2 text-sm text-gray-600">
            Answer question sets assigned by your teacher.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">My Progress</h2>
          <p className="mt-2 text-sm text-gray-600">
            View your scores and track your improvement.
          </p>
        </div>
      </div>
    </div>
  )
}
