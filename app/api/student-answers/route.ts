import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const questionSetId = searchParams.get('questionSetId')

  if (!questionSetId) {
    return NextResponse.json({ error: 'Missing questionSetId parameter' }, { status: 400 })
  }

  // Fetch the student's existing answers for this question set
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: answerList } = await (supabase.from('student_answers') as any)
    .select('*')
    .eq('question_set_id', questionSetId)
    .eq('student_id', user.id)
    .order('submitted_at', { ascending: false })
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answer = (answerList as any[] | null)?.[0]
  if (!answer) {
    return NextResponse.json({ error: 'No answers found for this question set' }, { status: 404 })
  }

  // Also fetch the question set for context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: setList } = await (supabase.from('question_sets') as any)
    .select('*')
    .eq('id', questionSetId)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questionSet = (setList as any[] | null)?.[0]

  // Fetch subtopic title
  let subtopicTitle = ''
  if (questionSet) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subtopicList } = await (supabase.from('subtopics') as any)
      .select('title')
      .eq('id', questionSet.subtopic_id)
      .limit(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subtopic = (subtopicList as any[] | null)?.[0]
    subtopicTitle = subtopic?.title || ''
  }

  return NextResponse.json({
    answer,
    questions: questionSet?.questions_json || [],
    subtopicTitle,
  })
}
