import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTopics(): Promise<any[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: topics } = await (supabase.from('topics') as any)
    .select('*')
    .order('order_number', { ascending: true })

  // Get subtopic counts for each topic
  if (!topics) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topicsWithCounts = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topics.map(async (topic: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase.from('subtopics') as any)
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', topic.id)

      return { ...topic, subtopic_count: count || 0 }
    })
  )

  return topicsWithCounts
}

export default async function TeacherTopicsPage() {
  const topics = await getTopics()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Topics Management</h1>
          <p className="mt-1 text-gray-600">
            Manage GCSE Computer Science curriculum topics, subtopics, and release them to students.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {topics.length} topics
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            href={`/teacher/topics/${topic.id}`}
            className="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-blue-300"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  J277/{topic.component}
                </span>
                <h2 className="mt-2 text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                  {topic.title}
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">
                {topic.subtopic_count}
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {topic.subtopic_count} subtopic{topic.subtopic_count !== 1 ? 's' : ''}
            </p>
          </Link>
        ))}
      </div>

      {topics.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No topics found. Run the seed script to populate the database.</p>
        </div>
      )}
    </div>
  )
}
