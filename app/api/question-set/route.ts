import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: setList } = await (supabase.from('question_sets') as any)
    .select('*')
    .eq('id', id)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questionSet = (setList as any[] | null)?.[0]
  if (!questionSet) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 })
  }

  // Also fetch the subtopic title
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subtopicList } = await (supabase.from('subtopics') as any)
    .select('title')
    .eq('id', questionSet.subtopic_id)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtopic = (subtopicList as any[] | null)?.[0]

  return NextResponse.json({
    questionSet,
    subtopicTitle: subtopic?.title || null,
  })
}
