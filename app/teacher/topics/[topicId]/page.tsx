import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function getTopic(topicId: string) {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: topicData } = await (supabase.from('topics') as any)
    .select('*')
    .eq('id', topicId)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topic = (topicData as any[] | null)?.[0]
  if (!topic) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subtopics } = await (supabase.from('subtopics') as any)
    .select('*')
    .eq('topic_id', topicId)
    .order('order_number', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ...topic, subtopics: (subtopics as any[]) || [] }
}

export default async function TeacherTopicDetailPage({
  params,
}: {
  params: { topicId: string }
}) {
  const topic = await getTopic(params.topicId)

  if (!topic) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher/topics"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          &larr; Back to Topics
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{topic.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Component J277/{topic.component} &middot; {topic.subtopics.length} subtopic{topic.subtopics.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {topic.subtopics.map((subtopic: any) => (
          <Link
            key={subtopic.id}
            href={`/teacher/topics/${topic.id}/${subtopic.id}`}
            className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-blue-300"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">
              {subtopic.order_number}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-medium text-gray-900 truncate">
                {subtopic.title}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {subtopic.content_json && typeof subtopic.content_json === 'object'
                  ? (() => {
                      const cj = subtopic.content_json as Record<string, unknown>
                      const lessons = cj.lessons
                      if (Array.isArray(lessons) && lessons.length > 0) {
                        return `${lessons.length} lesson${lessons.length !== 1 ? 's' : ''}`
                      }
                      if (Array.isArray(cj.learning_objectives)) {
                        return `Lesson content available`
                      }
                      return 'No lesson content yet'
                    })()
                  : 'No lesson content yet'}
              </p>
            </div>
            <svg className="h-5 w-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>

      {topic.subtopics.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No subtopics found for this topic.</p>
        </div>
      )}
    </div>
  )
}
