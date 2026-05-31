import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

function getScoreColor(score: number, maxScore: number): string {
  if (maxScore === 0) return 'text-gray-600 bg-gray-100'
  const ratio = score / maxScore
  if (ratio >= 0.7) return 'text-green-700 bg-green-100'
  if (ratio >= 0.4) return 'text-amber-700 bg-amber-100'
  return 'text-red-700 bg-red-100'
}

async function getStudentData(): Promise<{
  profile: { full_name: string; teacher_feedback: string | null; feedback_updated_at: string | null } | null
  completedSets: QuestionSetInfo[]
  totalQuestionsCompleted: number
  averageScore: number
  averagePercentage: number
  totalCompletedSets: number
  totalPossibleScore: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch profile and student answers in parallel (both only need user.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: profileList }, { data: allAnswers }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('profiles') as any)
      .select('full_name, organization_id, teacher_feedback, feedback_updated_at')
      .eq('id', user.id)
      .limit(1),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('student_answers') as any)
      .select('id, question_set_id, total_score, submitted_at')
      .eq('student_id', user.id),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (profileList as any[] | null)?.[0] || null
  const studentOrgId = profile?.organization_id

  // Find teachers in same org
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

  if (!allSets) {
    return {
      profile,
      completedSets: [],
      totalQuestionsCompleted: 0,
      averageScore: 0,
      averagePercentage: 0,
      totalCompletedSets: 0,
      totalPossibleScore: 0,
    }
  }

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

  // Filter to only completed sets
  const completedSets = result.filter((s) => s.answer !== null)

  // Calculate stats
  let totalQuestionsCompleted = 0
  let totalScore = 0
  let totalPossibleScore = 0

  for (const set of completedSets) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questions = (set.questions_json || []) as any[]
    const questionCount = Array.isArray(questions) ? questions.length : 0
    totalQuestionsCompleted += questionCount
    totalScore += set.answer?.total_score || 0
    totalPossibleScore += set.max_score
  }

  const averageScore = completedSets.length > 0
    ? Math.round((totalScore / completedSets.length) * 10) / 10
    : 0

  const averagePercentage = totalPossibleScore > 0
    ? Math.round((totalScore / totalPossibleScore) * 100)
    : 0

  return {
    profile,
    completedSets,
    totalQuestionsCompleted,
    averageScore,
    averagePercentage,
    totalCompletedSets: completedSets.length,
    totalPossibleScore,
  }
}

export default async function StudentDashboard() {
  const data = await getStudentData()
  const { profile } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="mt-1 text-gray-600">
          Welcome back, {profile?.full_name || 'Student'}
        </p>
      </div>

      {/* Teacher Feedback */}
      {profile?.teacher_feedback && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100">
              <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-indigo-900">Feedback from your teacher</h3>
              <p className="mt-1 text-sm text-indigo-800 whitespace-pre-wrap">{profile.teacher_feedback}</p>
              {profile.feedback_updated_at && (
                <p className="mt-1 text-xs text-indigo-500">
                  Last updated: {new Date(profile.feedback_updated_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Questions Answered</p>
          <p className="mt-2 text-3xl font-bold text-green-600">{data.totalQuestionsCompleted}</p>
          <p className="mt-1 text-xs text-gray-500">Across all completed sets</p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Completed Sets</p>
          <p className="mt-2 text-3xl font-bold text-green-600">{data.totalCompletedSets}</p>
          <p className="mt-1 text-xs text-gray-500">
            {data.totalCompletedSets === 1 ? 'set completed' : 'sets completed'}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Average Score</p>
          <p className="mt-2 text-3xl font-bold text-green-600">{data.averageScore}</p>
          <p className="mt-1 text-xs text-gray-500">per set</p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Overall Accuracy</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{data.averagePercentage}%</p>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all"
              style={{ width: `${data.averagePercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/student/topics"
          className="group rounded-lg border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-green-300"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-700 transition-colors">My Topics</h3>
              <p className="text-sm text-gray-500">Browse released topics and study lesson content</p>
            </div>
          </div>
        </Link>

        <Link
          href="/student/questions"
          className="group rounded-lg border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-green-300"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-700 transition-colors">Practice Questions</h3>
              <p className="text-sm text-gray-500">Complete question sets and get AI-marked feedback</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Grade History */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Grade History</h2>
          <p className="mt-1 text-sm text-gray-500">
            Your completed question sets and scores.
          </p>
        </div>

        {data.completedSets.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {data.completedSets.map((set) => {
              const scoreColor = getScoreColor(set.answer!.total_score, set.max_score)
              return (
                <Link
                  key={set.id}
                  href={`/student/questions/${set.id}?view=results`}
                  className="group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-green-50/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-green-700 transition-colors truncate">
                      {set.subtopic_title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {set.topic_title} &middot; {new Date(set.answer!.submitted_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${scoreColor}`}>
                      {set.answer!.total_score}/{set.max_score}
                    </span>
                    <svg className="h-4 w-4 text-gray-400 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-gray-700">No completed sets yet</h3>
            <p className="mt-2 text-sm text-gray-500">
              Head over to the Questions page to try a practice set!
            </p>
            <Link
              href="/student/questions"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              Go to Questions
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
