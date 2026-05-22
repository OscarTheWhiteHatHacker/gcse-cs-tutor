import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function generateViaAI(subtopicTitle: string, lessonContent: string): Promise<string> {
  const prompt = `You are an expert OCR GCSE Computer Science examiner. Generate 5 exam-style questions specifically based on the following lesson content for "${subtopicTitle}".

LESSON CONTENT:
${lessonContent}

Each question should: test understanding of the material above, have marks (1-5), and include a detailed mark scheme based on the lesson content. Return ONLY a JSON array where each item has: {question: string, marks: number, mark_scheme: string}. Only return the JSON array, no other text.`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2500,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    let errorMessage = `Groq returned ${response.status}`
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

  const { subtopicId } = await request.json()
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
  const content = subtopic.content_json as Record<string, unknown> | null
  let lessonContent = subtopicTitle
  if (content && typeof content === 'object') {
    const parts: string[] = []
    if (Array.isArray(content.learning_objectives)) {
      parts.push('LEARNING OBJECTIVES:\n' + (content.learning_objectives as string[]).map((o: string) => '- ' + o).join('\n'))
    }
    if (typeof content.explanation === 'string') {
      // Truncate explanation to avoid exceeding token limits
      const expl = (content.explanation as string).substring(0, 3000)
      parts.push('EXPLANATION:\n' + expl)
    }
    if (Array.isArray(content.key_points)) {
      parts.push('KEY POINTS:\n' + (content.key_points as string[]).map((k: string) => '- ' + k).join('\n'))
    }
    if (Array.isArray(content.examples)) {
      parts.push('EXAMPLES:\n' + (content.examples as string[]).map((e: string) => '- ' + e).join('\n'))
    }
    if (Array.isArray(content.common_misconceptions)) {
      parts.push('COMMON MISCONCEPTIONS:\n' + (content.common_misconceptions as string[]).map((m: string) => '- ' + m).join('\n'))
    }
    lessonContent = parts.join('\n\n')
  }

  // Call Groq
  let rawText: string
  try {
    rawText = await generateViaAI(subtopicTitle, lessonContent)
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
