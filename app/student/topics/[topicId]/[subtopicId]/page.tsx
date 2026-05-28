import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

interface LessonContent {
  learning_objectives: string[]
  explanation: string
  key_points: string[]
  examples: string[]
  common_misconceptions: string[]
}

interface Lesson {
  title: string
  content: LessonContent
}

interface SubtopicData {
  id: string
  topic_id: string
  title: string
  content_json: Record<string, unknown>
  order_number: number
}

interface TopicData {
  id: string
  component: string
  title: string
  order_number: number
}

async function getSubtopic(subtopicId: string): Promise<SubtopicData | null> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('subtopics') as any)
    .select('*')
    .eq('id', subtopicId)
    .limit(1)

  const items = data as SubtopicData[] | null
  return items?.[0] || null
}

async function getTopic(topicId: string): Promise<TopicData | null> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('topics') as any)
    .select('*')
    .eq('id', topicId)
    .limit(1)

  const items = data as TopicData[] | null
  return items?.[0] || null
}

async function checkReleased(subtopicId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Get student's organization_id
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

  if (teacherIds.length === 0) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('released_subtopics') as any)
    .select('id')
    .eq('subtopic_id', subtopicId)
    .in('teacher_id', teacherIds)
    .limit(1)

  return data && (data as unknown[]).length > 0
}

function renderInline(text: string) {
  const parts: React.ReactNode[] = []
  const remaining = text
  let idx = 0

  // Match **bold** or `code` — whichever comes first
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g
  let match: RegExpExecArray | null
  let lastIndex = 0

  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(remaining.slice(lastIndex, match.index))
    }
    if (match[2] !== undefined) {
      // Bold
      parts.push(<strong key={idx++}>{match[2]}</strong>)
    } else if (match[3] !== undefined) {
      // Code
      parts.push(<code key={idx++} className="bg-gray-100 text-red-600 px-1 rounded text-xs font-mono">{match[3]}</code>)
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < remaining.length) {
    parts.push(remaining.slice(lastIndex))
  }
  return parts.length > 0 ? parts : text
}

function renderExplanation(text: string) {
  return text.split('\n').map((line: string, i: number) => {
    if (line.startsWith('## ')) {
      return <h3 key={i} className="text-base font-semibold text-gray-900 mt-4 mb-2">{line.replace('## ', '')}</h3>
    }
    if (line.startsWith('### ')) {
      return <h4 key={i} className="text-sm font-semibold text-gray-800 mt-3 mb-1">{line.replace('### ', '')}</h4>
    }
    if (line.trim() === '') {
      return <br key={i} />
    }
    return <p key={i} className="mb-2">{renderInline(line)}</p>
  })
}

export default async function StudentSubtopicPage({
  params,
  searchParams,
}: {
  params: { topicId: string; subtopicId: string }
  searchParams: { lesson?: string }
}) {
  const [subtopic, topic, released] = await Promise.all([
    getSubtopic(params.subtopicId),
    getTopic(params.topicId),
    checkReleased(params.subtopicId),
  ])

  if (!subtopic || !topic) {
    notFound()
  }

  // Redirect if not released
  if (!released) {
    redirect(`/student/topics/${params.topicId}`)
  }

  const rawJson = subtopic.content_json as Record<string, unknown> | null

  // Detect format: new (lessons array) vs old (flat content)
  const lessons: Lesson[] = (rawJson?.lessons as Lesson[]) || []
  const hasLessons = lessons.length > 0

  // Also check for old flat format
  const hasFlatContent = !hasLessons && rawJson && Array.isArray(rawJson.learning_objectives)

  // Get current lesson index
  const currentLessonIndex = hasLessons
    ? Math.min(Math.max(parseInt(searchParams.lesson || '0', 10) || 0, 0), lessons.length - 1)
    : 0

  const content = hasLessons
    ? lessons[currentLessonIndex].content
    : hasFlatContent
    ? (rawJson as unknown as LessonContent)
    : null

  const lessonSelectorUrl = (index: number) =>
    `/student/topics/${topic.id}/${subtopic.id}?lesson=${index}`

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/student/topics/${topic.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          &larr; Back to {topic.title}
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-gray-900">{subtopic.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            J277/{topic.component} &middot; {topic.title}
          </p>
        </div>
      </div>

      {/* Lesson tabs */}
      {hasLessons && (
        <div className="flex gap-1 border-b border-gray-200 pb-px">
          {lessons.map((lesson, i) => (
            <Link
              key={i}
              href={lessonSelectorUrl(i)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                i === currentLessonIndex
                  ? 'bg-white border-gray-200 text-indigo-700 -mb-px'
                  : 'bg-gray-50 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {lesson.title}
            </Link>
          ))}
        </div>
      )}

      {hasLessons && (
        <p className="text-sm text-gray-500">
          Lesson {currentLessonIndex + 1} of {lessons.length}: <strong>{lessons[currentLessonIndex].title}</strong>
        </p>
      )}

      {content && content.learning_objectives ? (
        <div className="space-y-8">
          {/* Learning Objectives */}
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Learning Objectives</h2>
            <ul className="mt-4 space-y-2">
              {content.learning_objectives.map((obj: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 mt-0.5">
                    {i + 1}
                  </span>
                  {obj}
                </li>
              ))}
            </ul>
          </section>

          {/* Explanation */}
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Explanation</h2>
            <div className="mt-4 prose prose-sm max-w-none text-gray-700">
              {content.explanation ? (
                renderExplanation(content.explanation)
              ) : (
                <p className="text-gray-500 italic">No explanation available.</p>
              )}
            </div>
          </section>

          {/* Key Points */}
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Key Points</h2>
            <ul className="mt-4 space-y-2">
              {content.key_points.map((point: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <svg className="h-5 w-5 flex-shrink-0 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </section>

          {/* Examples */}
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Examples</h2>
            <div className="mt-4 space-y-3">
              {content.examples.map((example: string, i: number) => (
                <div key={i} className="rounded-md bg-amber-50 border border-amber-200 p-4">
                  <p className="text-xs font-medium text-amber-800 mb-1">Example {i + 1}</p>
                  <p className="text-sm text-amber-900">{example}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Common Misconceptions */}
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Common Misconceptions</h2>
            <div className="mt-4 space-y-3">
              {content.common_misconceptions.map((mc: string, i: number) => (
                <div key={i} className="rounded-md bg-red-50 border border-red-200 p-4">
                  <p className="text-xs font-medium text-red-800 mb-1">Misconception {i + 1}</p>
                  <p className="text-sm text-red-900">{mc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <h2 className="text-lg font-semibold text-gray-700">Lesson content not yet generated</h2>
          <p className="mt-2 text-sm text-gray-500">
            The lesson content for this subtopic has not been created yet.
            Please check back later.
          </p>
        </div>
      )}
    </div>
  )
}
