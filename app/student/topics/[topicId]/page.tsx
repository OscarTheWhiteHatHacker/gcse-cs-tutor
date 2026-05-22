import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type TopicRow = {
  id: string
  component: string
  title: string
  order_number: number
}

type SubtopicRow = {
  id: string
  topic_id: string
  title: string
  order_number: number
  content_json: unknown
}

async function getTopic(topicId: string): Promise<TopicRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('topics')
    .select('*')
    .eq('id', topicId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as any
}

async function getReleasedSubtopics(topicId: string): Promise<SubtopicRow[]> {
  const supabase = await createClient()

  // Get current user's organization_id
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileList } = await (supabase.from('profiles') as any)
    .select('organization_id')
    .eq('id', user.id)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studentProfile = (profileList as any[] | null)?.[0]
  const studentOrgId = studentProfile?.organization_id

  // Find teachers in same organization
  let teacherIds: string[] = []
  if (studentOrgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: teachersInOrg } = await (supabase.from('profiles') as any)
      .select('id')
      .eq('role', 'teacher')
      .eq('organization_id', studentOrgId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    teacherIds = ((teachersInOrg as any[]) || []).map((t: any) => t.id)
  }

  // Get released subtopic IDs for this topic by teachers in same org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: releasedData } = await (supabase.from('released_subtopics') as any)
    .select(`
      subtopic_id
    `)
    .filter('teacher_id', 'in', `(${teacherIds.map((id: string) => `"${id}"`).join(',')})`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const releasedIds = new Set((releasedData as any[])?.map((r: any) => r.subtopic_id) || [])

  if (releasedIds.size === 0) return []

  // Get all subtopics for this topic that are in released set
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('subtopics') as any)
    .select('*')
    .eq('topic_id', topicId)
    .in('id', Array.from(releasedIds))
    .order('order_number', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]) || []
}

export default async function StudentTopicDetailPage({
  params,
}: {
  params: { topicId: string }
}) {
  const [topic, subtopics] = await Promise.all([
    getTopic(params.topicId),
    getReleasedSubtopics(params.topicId),
  ])

  if (!topic) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/student/topics"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          &larr; Back to Topics
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{topic.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Component J277/{topic.component} &middot; {subtopics.length} released subtopic{subtopics.length !== 1 ? 's' : ''}
        </p>
      </div>

      {subtopics.length > 0 ? (
        <div className="space-y-3">
          {subtopics.map((subtopic) => (
            <Link
              key={subtopic.id}
              href={`/student/topics/${topic.id}/${subtopic.id}`}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-green-300"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-50 text-sm font-bold text-green-600">
                {subtopic.order_number}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-medium text-gray-900 truncate">
                  {subtopic.title}
                </h2>
                <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Released for study
                </p>
              </div>
              <svg className="h-5 w-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-gray-700">No subtopics released yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Your teacher hasn&apos;t released any subtopics for this topic yet.
          </p>
        </div>
      )}
    </div>
  )
}
