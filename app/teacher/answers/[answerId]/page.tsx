import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface AnswerData {
  id: string
  question_set_id: string
  student_id: string
  answers_json: unknown
  scores_json: unknown
  feedback_json: unknown
  submitted_at: string
  total_score: number
}

interface QuestionSetData {
  id: string
  subtopic_id: string
  questions_json: unknown
  created_at: string
}

interface ProfileData {
  id: string
  full_name: string
  email: string
}

interface SubtopicData {
  id: string
  title: string
  topic_id: string
}

interface TopicData {
  id: string
  title: string
}

interface Question {
  question: string
  marks: number
  mark_scheme: string
}

interface MarkedAnswer {
  questionIndex: number
  score: number
  feedback: string
  suggestions: string
}

function getScoreColor(score: number, maxMarks: number): string {
  const ratio = maxMarks > 0 ? score / maxMarks : 0
  if (ratio >= 0.7) return 'bg-green-100 text-green-800 border-green-200'
  if (ratio >= 0.4) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-red-100 text-red-800 border-red-200'
}

function getOverallScoreColor(score: number, maxScore: number): string {
  const ratio = maxScore > 0 ? score / maxScore : 0
  if (ratio >= 0.7) return 'bg-green-100 text-green-700'
  if (ratio >= 0.4) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

export default async function TeacherAnswerReviewPage({
  params,
}: {
  params: { answerId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check teacher role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileList } = await (supabase.from('profiles') as any)
    .select('role')
    .eq('id', user.id)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (profileList as any[] | null)?.[0]
  if (!profile || profile.role !== 'teacher') {
    redirect('/student')
  }

  // Fetch the student answer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: answerList } = await (supabase.from('student_answers') as any)
    .select('*')
    .eq('id', params.answerId)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answer = (answerList as any[] | null)?.[0] as AnswerData | undefined

  if (!answer) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/teacher" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            &larr; Back to Dashboard
          </Link>
        </div>
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-gray-700">Answer not found</h2>
          <p className="mt-2 text-sm text-gray-500">
            The answer you are looking for does not exist or has been removed.
          </p>
        </div>
      </div>
    )
  }

  // Fetch the question set
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: setList } = await (supabase.from('question_sets') as any)
    .select('*')
    .eq('id', answer.question_set_id)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questionSet = (setList as any[] | null)?.[0] as QuestionSetData | undefined

  if (!questionSet) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/teacher" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            &larr; Back to Dashboard
          </Link>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-800">Error</h2>
          <p className="mt-2 text-sm text-red-700">Associated question set not found.</p>
        </div>
      </div>
    )
  }

  // Fetch student profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studentList } = await (supabase.from('profiles') as any)
    .select('id, full_name, email')
    .eq('id', answer.student_id)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = (studentList as any[] | null)?.[0] as ProfileData | undefined

  // Fetch subtopic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subtopicList } = await (supabase.from('subtopics') as any)
    .select('id, title, topic_id')
    .eq('id', questionSet.subtopic_id)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtopic = (subtopicList as any[] | null)?.[0] as SubtopicData | undefined

  // Fetch topic
  let topicTitle = ''
  if (subtopic) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: topicList } = await (supabase.from('topics') as any)
      .select('id, title')
      .eq('id', subtopic.topic_id)
      .limit(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topic = (topicList as any[] | null)?.[0] as TopicData | undefined
    topicTitle = topic?.title || ''
  }

  // Parse data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions = (questionSet.questions_json || []) as Question[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markedAnswers = (answer.feedback_json || []) as MarkedAnswer[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answerEntries = (answer.answers_json || []) as { questionIndex: number; answer: string }[]
  const maxScore = questions.reduce((sum, q) => sum + (q.marks || 0), 0)

  // Build answer lookup
  const answerMap = new Map<number, string>()
  for (const entry of answerEntries) {
    answerMap.set(entry.questionIndex, entry.answer)
  }

  const subtopicTitle = subtopic?.title || 'Unknown Subtopic'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/teacher" className="text-sm font-medium text-blue-600 hover:text-blue-800">
          &larr; Back to Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Answer Review</h1>
      </div>

      {/* Student & Set Info Card */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Student</p>
            <p className="mt-1 text-base font-semibold text-gray-900">{student?.full_name || 'Unknown Student'}</p>
            {student?.email && (
              <p className="text-sm text-gray-500">{student.email}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Question Set</p>
            <p className="mt-1 text-base font-semibold text-gray-900">{subtopicTitle}</p>
            {topicTitle && (
              <p className="text-sm text-gray-500">{topicTitle}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Submitted</p>
            <p className="mt-1 text-base font-semibold text-gray-900">
              {new Date(answer.submitted_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p className="text-sm text-gray-500">
              {new Date(answer.submitted_at).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Score</p>
            <div className={`mt-1 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-lg font-bold ${getOverallScoreColor(answer.total_score, maxScore)}`}>
              {answer.total_score}/{maxScore}
            </div>
          </div>
        </div>
      </div>

      {/* Question Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Question Breakdown</h2>
        {questions.map((question, i) => {
          const marked = markedAnswers.find((m) => m.questionIndex === i)
          const studentAnswer = answerMap.get(i) || ''
          const score = marked?.score ?? 0
          const marks = question.marks || 0

          return (
            <div key={i} className="rounded-lg border bg-white shadow-sm transition-all hover:shadow-md">
              {/* Question Header */}
              <div className="flex items-start justify-between gap-4 border-b bg-gray-50 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                      {i + 1}
                    </span>
                    <h3 className="text-base font-semibold text-gray-900">Question {i + 1}</h3>
                  </div>
                </div>
                <div className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${getScoreColor(score, marks)}`}>
                  {score}/{marks}
                </div>
              </div>

              {/* Question Text */}
              <div className="px-6 py-4">
                <div className="rounded-md bg-gray-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Question</p>
                  <p className="mt-1 text-sm text-gray-900">{question.question}</p>
                </div>
              </div>

              {/* Student Answer */}
              <div className="border-t px-6 py-4">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Student&apos;s Answer</p>
                <div className="mt-1 rounded-md border border-blue-100 bg-blue-50 p-3">
                  <p className="text-sm text-blue-900 whitespace-pre-wrap">{studentAnswer || <span className="italic text-blue-400">(no answer provided)</span>}</p>
                </div>
              </div>

              {/* Feedback */}
              {marked && (
                <>
                  <div className="border-t px-6 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Feedback</p>
                    <div className="mt-1 rounded-md border border-green-100 bg-green-50 p-3">
                      <p className="text-sm text-green-800">{marked.feedback}</p>
                    </div>
                  </div>

                  {/* Suggestions */}
                  {marked.suggestions && marked.suggestions !== 'N/A' && (
                    <div className="border-t px-6 py-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Suggestions for Improvement</p>
                      <div className="mt-1 rounded-md border border-purple-100 bg-purple-50 p-3">
                        <p className="text-sm text-purple-800">{marked.suggestions}</p>
                      </div>
                    </div>
                  )}

                  {/* Mark Scheme (collapsible reference for teachers) */}
                  {question.mark_scheme && (
                    <div className="border-t px-6 py-4">
                      <details className="group">
                        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700">
                          <span className="select-none">Mark Scheme Reference</span>
                        </summary>
                        <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 p-3">
                          <p className="text-sm text-amber-800 whitespace-pre-wrap">{question.mark_scheme}</p>
                        </div>
                      </details>
                    </div>
                  )}
                </>
              )}

              {/* No marking data */}
              {!marked && (
                <div className="border-t px-6 py-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Feedback</p>
                  <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm italic text-gray-500">No feedback available for this question.</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          {questions.length} question{questions.length !== 1 ? 's' : ''} &middot; Total: {answer.total_score}/{maxScore} marks
        </p>
        <Link
          href="/teacher"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
