import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface QuestionSetInfo {
  id: string
  subtopic_id: string
  teacher_id: string
  questions_json: unknown
  created_at: string
  subtopic_title: string
  topic_title: string
  answer: {
    id: string
    total_score: number
    submitted_at: string
  } | null
  max_score: number
}

async function getStudentQuestionSets(): Promise<QuestionSetInfo[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

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

  // Build query for question sets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qsQuery = (supabase.from('question_sets') as any)
    .select(`
      *,
      subtopics!inner (
        title,
        topics!inner (
          title
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (teacherIds.length > 0) {
    qsQuery = qsQuery.in('teacher_id', teacherIds)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allSets } = await qsQuery

  if (!allSets) return []

  // Get all student answers for this student
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allAnswers } = await (supabase.from('student_answers') as any)
    .select('id, question_set_id, total_score, submitted_at')
    .eq('student_id', user.id)

  // Build answer lookup map
  const answerMap = new Map<string, { id: string; total_score: number; submitted_at: string }>()
  if (allAnswers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ans of allAnswers as any[]) {
      answerMap.set(ans.question_set_id, {
        id: ans.id,
        total_score: ans.total_score,
        submitted_at: ans.submitted_at,
      })
    }
  }

  // Build result with subtopic title and max score
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: QuestionSetInfo[] = (allSets as any[]).map((set: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questions = (set.questions_json || []) as any[]
    const maxScore = Array.isArray(questions)
      ? questions.reduce((sum: number, q: { marks?: number }) => sum + (q.marks || 0), 0)
      : 0

    return {
      id: set.id,
      subtopic_id: set.subtopic_id,
      teacher_id: set.teacher_id,
      questions_json: set.questions_json,
      created_at: set.created_at,
      subtopic_title: set.subtopics?.title || 'Unknown Subtopic',
      topic_title: set.subtopics?.topics?.title || 'Unknown Topic',
      answer: answerMap.get(set.id) || null,
      max_score: maxScore,
    }
  })

  return result
}

export default async function StudentQuestionsPage() {
  const questionSets = await getStudentQuestionSets()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Practice Questions</h1>
        <p className="mt-1 text-gray-600">
          Question sets assigned by your teacher. Complete them to get AI-marked feedback.
        </p>
      </div>

      {questionSets.length > 0 ? (
        <div className="space-y-4">
          {questionSets.map((set) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const questions = (set.questions_json || []) as any[]
            const questionCount = Array.isArray(questions) ? questions.length : 0
            const isCompleted = set.answer !== null

            return (
              <Link
                key={set.id}
                href={isCompleted ? `/student/questions/${set.id}?view=results` : `/student/questions/${set.id}`}
                className={`block rounded-lg border bg-white p-6 shadow-sm transition-all hover:shadow-md ${
                  isCompleted ? 'hover:border-green-300' : 'hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900 truncate">
                      {set.subtopic_title}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {set.topic_title}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {questionCount} question{questionCount !== 1 ? 's' : ''}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {set.max_score} mark{set.max_score !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <div className="text-right">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                          Completed
                        </span>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          Score: {set.answer!.total_score}/{set.max_score}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(set.answer!.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                        Not started
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-gray-700">No question sets yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Your teacher hasn&apos;t assigned any question sets yet. Check back later!
          </p>
        </div>
      )}
    </div>
  )
}
