import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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

    // Fetch all subtopics with their topic info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subtopics } = await (supabase.from('subtopics') as any)
      .select(`
        id,
        title,
        topics!inner (
          title,
          component
        )
      `)
      .order('order_number')

    if (!subtopics || !Array.isArray(subtopics)) {
      return NextResponse.json({ error: 'No subtopics found' }, { status: 404 })
    }

    const results: Record<string, string> = {}

    for (const sub of subtopics) {
      const topicTitle = sub.topics?.title || 'Unknown Topic'
      const component = sub.topics?.component || '01'

      const prompt = `You are an expert OCR GCSE Computer Science teacher. Generate in-depth, comprehensive lesson content for the following subtopic.

Specification: OCR GCSE Computer Science J277
Component: ${component === '01' ? '01 — Computer systems' : '02 — Computational thinking, algorithms and programming'}
Topic: ${topicTitle}
Subtopic: ${sub.title}

The content must be suitable for 14-16 year old GCSE students. Be thorough but accessible.

Return a JSON object with these exact fields:

1. "learning_objectives": Array of 4-5 specific learning objectives, each starting with a verb (Define, Explain, Describe, Compare, Evaluate). They should explicitly reference exam board requirements.

2. "explanation": A detailed markdown-formatted explanation (at least 500 words). Use:
   - ## headings for sections
   - **bold** for key terms
   - bullet points for lists
   - \`code\` for technical terms
   Cover: what it is, how it works, why it matters, real-world applications, and exam-relevant details.

3. "key_points": Array of 8-10 concise, specific bullet points summarising the most important facts students must remember for exams.

4. "examples": Array of 4 exam-style examples or scenarios. Each should include a short scenario and explanation of why it's relevant. These should mirror the style of OCR GCSE exam questions.

5. "common_misconceptions": Array of 4 specific misconceptions students often have about this topic. Each should state the misconception, then explain why it's wrong and what the correct understanding is.

Return ONLY valid JSON. No markdown wrapping, no extra text.`

      // Wait 2.5s between calls to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2500))

      try {
        let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 3000,
          }),
        })

        // Retry up to 3 times on rate limit
        let retries = 0
        while (response.status === 429 && retries < 3) {
          retries++
          await new Promise((resolve) => setTimeout(resolve, 4000 * retries))
          response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.5,
              max_tokens: 3000,
            }),
          })
        }

        if (!response.ok) {
          results[sub.title] = `API error: ${response.status}`
          continue
        }

        const data = await response.json()
        const rawContent = data?.choices?.[0]?.message?.content

        if (!rawContent) {
          results[sub.title] = 'Empty response'
          continue
        }

        // Strip control characters that break JSON.parse
        let cleaned = rawContent.trim()
        if (cleaned.startsWith('```json') || cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
        }

        // Replace all control characters with spaces (safe for JSON)
        cleaned = cleaned.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').replace(/  +/g, ' ')

        const parsed = JSON.parse(cleaned)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = {
          learning_objectives: Array.isArray(parsed.learning_objectives) ? parsed.learning_objectives : [],
          explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
          key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
          examples: Array.isArray(parsed.examples) ? parsed.examples : [],
          common_misconceptions: Array.isArray(parsed.common_misconceptions) ? parsed.common_misconceptions : [],
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from('subtopics') as any)
          .update({ content_json: content })
          .eq('id', sub.id)

        if (updateError) {
          results[sub.title] = `DB error: ${updateError.message}`
        } else {
          results[sub.title] = '✅ Updated'
        }
      } catch (err) {
        results[sub.title] = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
