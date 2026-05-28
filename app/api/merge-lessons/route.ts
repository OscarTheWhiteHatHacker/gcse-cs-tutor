import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function mergeLessons(existingLessons: Array<{ title: string; content: Record<string, unknown> }>) {
  if (!existingLessons || existingLessons.length === 0) return null

  // Collect all learning objectives across lessons
  const allObjectives: string[] = []
  const allKeyPoints: string[] = []
  const allExamples: string[] = []
  const allMisconceptions: string[] = []
  const allExplanations: string[] = []

  for (const lesson of existingLessons) {
    const c = lesson.content
    if (Array.isArray(c.learning_objectives)) {
      allObjectives.push(...c.learning_objectives)
    }
    if (Array.isArray(c.key_points)) {
      allKeyPoints.push(...c.key_points)
    }
    if (Array.isArray(c.examples)) {
      allExamples.push(...c.examples)
    }
    if (Array.isArray(c.common_misconceptions)) {
      allMisconceptions.push(...c.common_misconceptions)
    }
    if (typeof c.explanation === 'string' && c.explanation) {
      allExplanations.push(c.explanation)
    }
  }

  // Build combined explanation with clear sections
  const combinedExplanation = allExplanations.map((exp, i) => {
    const lessonTitle = existingLessons[i]?.title || `Part ${i + 1}`
    // Extract the first heading to use as section title
    const firstHeading = exp.match(/^## .+$/m)
    if (firstHeading) {
      // Already has a heading — use as-is
      return exp
    }
    return `## ${lessonTitle}\n\n${exp}`
  }).join('\n\n---\n\n')

  // Deduplicate objectives and key points (case-insensitive)
  const seenObjectives = new Set<string>()
  const dedupedObjectives = allObjectives.filter(obj => {
    const lower = obj.toLowerCase().trim()
    if (seenObjectives.has(lower)) return false
    seenObjectives.add(lower)
    return true
  })

  const seenKeyPoints = new Set<string>()
  const dedupedKeyPoints = allKeyPoints.filter(kp => {
    const lower = kp.toLowerCase().trim()
    if (seenKeyPoints.has(lower)) return false
    seenKeyPoints.add(lower)
    return true
  })

  const seenExamples = new Set<string>()
  const dedupedExamples = allExamples.filter(ex => {
    const lower = ex.toLowerCase().trim()
    if (seenExamples.has(lower)) return false
    seenExamples.add(lower)
    return true
  })

  const seenMisconceptions = new Set<string>()
  const dedupedMisconceptions = allMisconceptions.filter(mc => {
    const lower = mc.toLowerCase().trim()
    if (seenMisconceptions.has(lower)) return false
    seenMisconceptions.add(lower)
    return true
  })

  return {
    learning_objectives: dedupedObjectives,
    explanation: combinedExplanation,
    key_points: dedupedKeyPoints,
    examples: dedupedExamples,
    common_misconceptions: dedupedMisconceptions,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (body.secret !== process.env.WIPE_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { cookies: { getAll: () => [], setAll: () => {} } },
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subtopics } = await (supabase.from('subtopics') as any)
      .select('id, title, content_json')
      .order('order_number')

    if (!subtopics || !Array.isArray(subtopics)) {
      return NextResponse.json({ error: 'No subtopics found' }, { status: 404 })
    }

    const results: Record<string, string> = {}
    const specificSubtopic = body.subtopicTitle as string | undefined

    for (const sub of subtopics) {
      if (specificSubtopic && sub.title !== specificSubtopic) continue

      const rawJson = sub.content_json as Record<string, unknown> | null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingLessons = (rawJson?.lessons as any[]) || []

      if (!existingLessons || existingLessons.length === 0) {
        results[sub.title] = 'No lessons to merge'
        continue
      }

      const mergedContent = mergeLessons(existingLessons)
      if (!mergedContent) {
        results[sub.title] = 'Merge failed'
        continue
      }

      const megaLesson = {
        title: `${sub.title} — Complete Lesson`,
        content: mergedContent,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from('subtopics') as any)
        .update({ content_json: { lessons: [megaLesson] } })
        .eq('id', sub.id)

      if (updateError) {
        results[sub.title] = `DB error: ${updateError.message}`
      } else {
        const lessonCount = existingLessons.length
        results[sub.title] = `✅ Merged ${lessonCount} lessons into 1 (${mergedContent.key_points.length} key points, ${mergedContent.examples.length} examples)`
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
