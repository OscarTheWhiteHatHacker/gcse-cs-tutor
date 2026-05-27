import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { secret, subtopicId, subtopicTitle, lessons } = body

    if (secret !== process.env.WIPE_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if ((!subtopicId && !subtopicTitle) || !lessons || !Array.isArray(lessons)) {
      return NextResponse.json({ error: 'Missing subtopicId/subtopicTitle or lessons array' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Find subtopic ID by title if not provided
    let targetId = subtopicId
    if (!targetId && subtopicTitle) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: subs } = await (supabase.from('subtopics') as any)
        .select('id')
        .eq('title', subtopicTitle)
        .limit(1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = (subs as any[] | null)?.[0]
      if (!found) {
        return NextResponse.json({ error: `Subtopic not found: ${subtopicTitle}` }, { status: 404 })
      }
      targetId = found.id
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from('subtopics') as any)
      .update({ content_json: { lessons } })
      .eq('id', targetId)

    if (updateError) {
      return NextResponse.json({ error: `DB error: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, lessonCount: lessons.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
