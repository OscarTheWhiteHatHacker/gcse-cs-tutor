import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function generateViaOpenRouter(subtopicTitle: string): Promise<string> {
  const prompt = `You are an expert OCR GCSE Computer Science examiner. Generate 5 exam-style questions for the subtopic: ${subtopicTitle}. Each question should have: question text, marks available (1-5), and a detailed mark scheme. Return the response as a JSON array where each item has: {question: string, marks: number, mark_scheme: string}. Only return the JSON array, no other text.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://gcse-cs-tutor.vercel.app',
      'X-Title': 'GCSE CS Tutor',
    },
    body: JSON.stringify({
      model: 'mistralai/mistral-7b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2500,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    let errorMessage = `OpenRouter returned ${response.status}`
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
    throw new Error('Empty response from OpenRouter')
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

  // Fetch the subtopic to get its title
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subtopicList } = await (supabase.from('subtopics') as any)
    .select('title')
    .eq('id', subtopicId)
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtopic = (subtopicList as any[] | null)?.[0]
  if (!subtopic) {
    return NextResponse.json({ error: 'Subtopic not found' }, { status: 404 })
  }

  const subtopicTitle = subtopic.title

  // Call OpenRouter
  let rawText: string
  try {
    rawText = await generateViaOpenRouter(subtopicTitle)
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
