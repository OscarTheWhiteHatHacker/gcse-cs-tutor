import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// 11 subtopics × 3-4 lessons = ~35 AI calls
const LESSONS_PER_SUBTOPIC = 3

const LESSON_TEMPLATES: Record<string, string[]> = {
  'Systems architecture': [
    'CPU Architecture and Components',
    'The Fetch-Execute Cycle',
    'CPU Performance Factors',
  ],
  'Memory and storage': [
    'RAM, ROM and Virtual Memory',
    'Secondary Storage Devices',
    'Units of Data Storage',
  ],
  'Computer networks': [
    'Types of Networks (LAN and WAN)',
    'Network Topologies and Protocols',
    'Network Hardware and Transmission',
  ],
  'Network security': [
    'Forms of Network Attack',
    'Preventing Network Vulnerabilities',
    'Encryption and Authentication',
  ],
  'Systems software': [
    'Operating Systems',
    'Utility Software',
    'The Role of the OS',
  ],
  'Ethical, legal, environmental and cultural impacts': [
    'Ethical and Cultural Issues',
    'Legal Legislation in Computing',
    'Environmental Impact of Technology',
  ],
  'Algorithms': [
    'Computational Thinking',
    'Sorting Algorithms',
    'Searching Algorithms',
  ],
  'Programming fundamentals': [
    'Variables, Constants and Data Types',
    'Selection and Iteration',
    'Arrays and Subprograms',
  ],
  'Producing robust programs': [
    'Defensive Design Considerations',
    'Testing and Debugging',
    'Maintainability and Readability',
  ],
  'Boolean logic': [
    'Logic Gates and Truth Tables',
    'Boolean Expressions',
    'Applying Logic to Problems',
  ],
  'Programming languages and IDEs': [
    'Types of Programming Languages',
    'Translators: Compilers and Interpreters',
    'Integrated Development Environments (IDEs)',
  ],
}

async function generateLesson(subtopicTitle: string, lessonTitle: string): Promise<Record<string, unknown>> {
  const prompt = `You are an expert OCR GCSE Computer Science teacher. Generate a comprehensive lesson for GCSE students (ages 14-16).

Subtopic: ${subtopicTitle}
Lesson: ${lessonTitle}

Return JSON with these exact fields:
1. "learning_objectives": Array of 4-5 specific objectives starting with verbs like Define, Explain, Describe, Compare
2. "explanation": Detailed markdown explanation (300-400 words), using ## headings, **bold** for key terms, bullet points
3. "key_points": Array of 6-8 concise bullet-point facts students must remember
4. "examples": Array of 3 exam-style examples with scenarios
5. "common_misconceptions": Array of 3 specific misconceptions with corrections

Return ONLY valid JSON. No markdown wrapping.`

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 2500,
    }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  const data = await response.json()
  const raw = data?.choices?.[0]?.message?.content
  if (!raw) throw new Error('Empty response')

  let cleaned = raw.trim()
  if (cleaned.startsWith('```json') || cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }
  cleaned = cleaned.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').replace(/  +/g, ' ')

  const parsed = JSON.parse(cleaned)
  return {
    learning_objectives: Array.isArray(parsed.learning_objectives) ? parsed.learning_objectives : [],
    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
    key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
    examples: Array.isArray(parsed.examples) ? parsed.examples : [],
    common_misconceptions: Array.isArray(parsed.common_misconceptions) ? parsed.common_misconceptions : [],
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
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Fetch all subtopics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subtopics } = await (supabase.from('subtopics') as any)
      .select('id, title')
      .order('order_number')

    if (!subtopics || !Array.isArray(subtopics)) {
      return NextResponse.json({ error: 'No subtopics found' }, { status: 404 })
    }

    const results: Record<string, string> = {}
    const specificSubtopic = body.subtopicTitle as string | undefined

    for (const sub of subtopics) {
      if (specificSubtopic && sub.title !== specificSubtopic) continue

      const templates = LESSON_TEMPLATES[sub.title]
      if (!templates) {
        results[sub.title] = 'No template found'
        continue
      }

      const lessons: Array<{ title: string; content: Record<string, unknown> }> = []

      for (let i = 0; i < templates.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000))

        try {
          const content = await generateLesson(sub.title, templates[i])
          lessons.push({ title: templates[i], content })
        } catch (err) {
          results[`${sub.title} / ${templates[i]}`] = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
        }
      }

      if (lessons.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from('subtopics') as any)
          .update({ content_json: { lessons } })
          .eq('id', sub.id)

        if (updateError) {
          results[sub.title] = `DB error: ${updateError.message}`
        } else {
          results[sub.title] = `✅ ${lessons.length} lessons`
        }
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
