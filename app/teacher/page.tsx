import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function TeacherDashboard() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="mt-1 text-gray-600">
          Welcome back, {profile?.full_name || 'Teacher'}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Topics</h2>
          <p className="mt-2 text-sm text-gray-600">
            Manage GCSE Computer Science curriculum topics and subtopics.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Question Sets</h2>
          <p className="mt-2 text-sm text-gray-600">
            Create and manage question sets for your students.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Student Progress</h2>
          <p className="mt-2 text-sm text-gray-600">
            View student answers and track progress.
          </p>
        </div>
      </div>
    </div>
  )
}
