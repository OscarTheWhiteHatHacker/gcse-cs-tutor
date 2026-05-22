import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check user is a teacher
  const { data: profileList } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .limit(1)

  const profile = (profileList as Database['public']['Tables']['profiles']['Row'][] | null)?.[0]
  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers can release subtopics' }, { status: 403 })
  }

  const { subtopicId, action } = await request.json()

  if (!subtopicId || !action) {
    return NextResponse.json({ error: 'Missing subtopicId or action' }, { status: 400 })
  }

  if (action === 'release') {
    // Check if already released
    const { data: existingList } = await supabase
      .from('released_subtopics')
      .select('id')
      .eq('subtopic_id', subtopicId)
      .eq('teacher_id', user.id)

    if (existingList && existingList.length > 0) {
      return NextResponse.json({ released: true, message: 'Already released' })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('released_subtopics') as any)
      .insert({
        subtopic_id: subtopicId,
        teacher_id: user.id,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ released: true })
  }

  if (action === 'unrelease') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('released_subtopics') as any)
      .delete()
      .eq('subtopic_id', subtopicId)
      .eq('teacher_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ released: false })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check user is a teacher
  const { data: profileList } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .limit(1)

  const profile = (profileList as Database['public']['Tables']['profiles']['Row'][] | null)?.[0]
  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const subtopicId = searchParams.get('subtopicId')

  if (!subtopicId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('released_subtopics') as any)
      .select('subtopic_id')
      .eq('teacher_id', user.id)

    return NextResponse.json({ released: (data as { subtopic_id: string }[] | null)?.map(r => r.subtopic_id) || [] })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('released_subtopics') as any)
    .select('id')
    .eq('subtopic_id', subtopicId)
    .eq('teacher_id', user.id)

  const isReleased = data && data.length > 0
  return NextResponse.json({ released: !!isReleased })
}
