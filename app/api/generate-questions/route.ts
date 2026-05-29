import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function generateViaAI(subtopicTitle: string, lessonContent: string, existingQuestions: string = ''): Promise<string> {
  let prompt = `You are an expert OCR GCSE Computer Science examiner. Generate 5 exam-style questions based ONLY on the following lesson content for "${subtopicTitle}".

LESSON CONTENT:
${lessonContent}

CRITICAL RULES:
- Each question must be a PURE COMPREHENSION question — test only understanding of facts AND concepts EXPLICITLY stated in the lesson content above. The student must be able to answer from the lesson alone.
- Do NOT ask students to write code, pseudocode, draw diagrams, create flowcharts, or do anything they would need external knowledge or tools for.
- Do NOT ask students to write code, pseudocode, programs, algorithms, or draw/create flowcharts or diagrams — they can only type text into a box.
- Questions should use "Define", "Explain", "Describe", "State", "Identify", "List", "Compare", "Give an example of", "What is meant by", "Why is...", "Write down".
- If the lesson explains what pseudocode IS, do not ask students to write pseudocode — ask them to describe its purpose or identify key features.
- Each question should have marks (1-5) and include a mark scheme based ONLY on the lesson content.
- Return ONLY a JSON array where each item has: {question: string, marks: number, mark_scheme: string}. Only return the JSON array, no other text.`

  if (existingQuestions) {
    prompt = `You are an expert OCR GCSE Computer Science examiner. Generate 5 NEW exam-style questions based ONLY on the following lesson content for "${subtopicTitle}". The questions MUST be different from any previously generated for this topic.

LESSON CONTENT:
${lessonContent}

PREVIOUS QUESTIONS (DO NOT REPEAT THESE):
${existingQuestions}

CRITICAL RULES:
- Each question must be a PURE COMPREHENSION question — test only understanding of facts AND concepts EXPLICITLY stated in the lesson content above. The student must be able to answer from the lesson alone.
- Do NOT ask students to write code, pseudocode, draw diagrams, create flowcharts, or do anything they would need external knowledge or tools for.
- Do NOT ask students to write code, pseudocode, programs, algorithms, or draw/create flowcharts or diagrams — they can only type text into a box.
- Questions should use "Define", "Explain", "Describe", "State", "Identify", "List", "Compare", "Give an example of", "What is meant by", "Why is...", "Write down".
- If the lesson explains what pseudocode IS, do not ask students to write pseudocode — ask them to describe its purpose or identify key features.
- Each question should have marks (1-5) and include a mark scheme based ONLY on the lesson content.
- Return ONLY a JSON array where each item has: {question: string, marks: number, mark_scheme: string}. Only return the JSON array, no other text.`
  }

  const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GITHUB_MODELS_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2500,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    let errorMessage = `GitHub Models returned ${response.status}`
    try {
      const errorJson = JSON.parse(errorBody)
      if (errorJson.error?.message) {
        errorMessage += `: ${errorJson.error.message}`
      }
    } catch {
      // ignore parse error
    }
    throw new Error(errorMessage)
  }

  const data = await response.json()
  const rawContent = data?.choices?.[0]?.message?.content

  if (!rawContent) {
    throw new Error('Empty response from AI provider')
  }

  return rawContent
}

function parseQuestionsJson(rawContent: string): { questions: unknown[]; rawText: string } {
  let cleaned = rawContent.trim()
  // Handle markdown code blocks
  if (cleaned.startsWith('```json') || cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }

  const parsed = JSON.parse(cleaned)

  if (!Array.isArray(parsed)) {
    throw new Error('Response is not a JSON array')
  }

  // Validate each item has required fields
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]
    if (!item.question || typeof item.question !== 'string') {
      throw new Error(`Item ${i} missing valid 'question' field`)
    }
    if (!item.marks || typeof item.marks !== 'number') {
      throw new Error(`Item ${i} missing valid 'marks' field`)
    }
    if (!item.mark_scheme || typeof item.mark_scheme !== 'string') {
      throw new Error(`Item ${i} missing valid 'mark_scheme' field`)
    }
  }

  return { questions: parsed, rawText: cleaned }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check user is a teacher
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileList } = await (supabase.from('profiles') as any)
    .select('role')
    .eq('id', user.id)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (profileList as any[] | null)?.[0]
  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers can generate question sets' }, { status: 403 })
  }

  const body = await request.json()
  const { subtopicId, lessonIndex } = body

  if (!subtopicId) {
    return NextResponse.json({ error: 'Missing subtopicId' }, { status: 400 })
  }

  // Fetch the subtopic to get its title and lesson content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subtopicList } = await (supabase.from('subtopics') as any)
    .select('title, content_json')
    .eq('id', subtopicId)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtopic = (subtopicList as any[] | null)?.[0]
  if (!subtopic) {
    return NextResponse.json({ error: 'Subtopic not found' }, { status: 404 })
  }

  const subtopicTitle = subtopic.title

  // Build lesson content summary for the AI prompt
  const rawJson = subtopic.content_json as Record<string, unknown> | null
  const lessons = (rawJson?.lessons as Array<{ title: string; content: Record<string, unknown> }> | undefined) || []
  const hasLessons = lessons.length > 0

  // Determine which lesson content to use
  let lessonTitle = subtopicTitle
  let content: Record<string, unknown> | null = null

  if (hasLessons && typeof lessonIndex === 'number') {
    const idx = Math.min(Math.max(lessonIndex, 0), lessons.length - 1)
    const lesson = lessons[idx]
    lessonTitle = `${subtopicTitle} - ${lesson.title}`
    content = lesson.content as Record<string, unknown>
  } else if (rawJson && !hasLessons) {
    content = rawJson
  } else if (hasLessons) {
    // No lessonIndex provided, use first lesson
    content = lessons[0].content as Record<string, unknown>
  }

  let lessonContent = lessonTitle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = content as any
  if (c && typeof c === 'object') {
    const parts: string[] = []
    if (Array.isArray(c.learning_objectives)) {
      parts.push('LEARNING OBJECTIVES:\n' + (c.learning_objectives as string[]).map((o: string) => '- ' + o).join('\n'))
    }
    if (typeof c.explanation === 'string') {
      const expl = (c.explanation as string).substring(0, 3000)
      parts.push('EXPLANATION:\n' + expl)
    }
    if (Array.isArray(c.key_points)) {
      parts.push('KEY POINTS:\n' + (c.key_points as string[]).map((k: string) => '- ' + k).join('\n'))
    }
    if (Array.isArray(c.examples)) {
      parts.push('EXAMPLES:\n' + (c.examples as string[]).map((e: string) => '- ' + e).join('\n'))
    }
    if (Array.isArray(c.common_misconceptions)) {
      parts.push('COMMON MISCONCEPTIONS:\n' + (c.common_misconceptions as string[]).map((m: string) => '- ' + m).join('\n'))
    }
    lessonContent = parts.join('\n\n')
  }

  // Fetch existing question sets for this subtopic to avoid repeating questions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingSets } = await (supabase.from('question_sets') as any)
    .select('questions_json')
    .eq('subtopic_id', subtopicId)
    .order('created_at', { ascending: false })
    .limit(5)

  let existingQuestions = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (existingSets && (existingSets as any[]).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevQuestions = (existingSets as any[]).flatMap((set: any) => {
      const qs = set.questions_json
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Array.isArray(qs) ? qs.map((q: any) => q.question || '') : []
    })
    if (prevQuestions.length > 0) {
      existingQuestions = prevQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')
    }
  }

  // Call Groq
  let rawText: string
  try {
    rawText = await generateViaAI(subtopicTitle, lessonContent, existingQuestions)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error generating questions'
    return NextResponse.json({
      error: 'Failed to generate questions',
      details: message,
      subtopicTitle,
    }, { status: 502 })
  }

  // Parse JSON response
  let questions: unknown[]
  try {
    const result = parseQuestionsJson(rawText)
    questions = result.questions
  } catch (parseErr) {
    // Parse failed - store raw text and return error
    const parseMessage = parseErr instanceof Error ? parseErr.message : 'Failed to parse AI response'

    // Still store the raw attempt so teacher can see what happened
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('question_sets') as any)
      .insert({
        subtopic_id: subtopicId,
        teacher_id: user.id,
        questions_json: { raw_text: rawText, parse_error: parseMessage },
      })

    return NextResponse.json({
      error: 'Failed to parse generated questions',
      details: parseMessage,
      rawText,
    }, { status: 422 })
  }

  // Insert the question set into DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newSet, error: insertError } = await (supabase.from('question_sets') as any)
    .insert({
      subtopic_id: subtopicId,
      teacher_id: user.id,
      questions_json: questions,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: 'Failed to save question set', details: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    questionSet: newSet,
  })
}
