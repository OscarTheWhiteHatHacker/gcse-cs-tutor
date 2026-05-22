import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TOPICS = [
  {
    component: '01' as const,
    title: 'Computer systems',
    order_number: 1,
    subtopics: [
      { title: 'Systems architecture', order_number: 1 },
      { title: 'Memory and storage', order_number: 2 },
      { title: 'Computer networks', order_number: 3 },
      { title: 'Network security', order_number: 4 },
      { title: 'Systems software', order_number: 5 },
      { title: 'Ethical, legal, environmental and cultural impacts', order_number: 6 },
    ],
  },
  {
    component: '02' as const,
    title: 'Computational thinking, algorithms and programming',
    order_number: 2,
    subtopics: [
      { title: 'Algorithms', order_number: 1 },
      { title: 'Programming fundamentals', order_number: 2 },
      { title: 'Producing robust programs', order_number: 3 },
      { title: 'Boolean logic', order_number: 4 },
      { title: 'Programming languages and IDEs', order_number: 5 },
    ],
  },
]

async function generateContent(subtopicTitle: string): Promise<Record<string, unknown>> {
  const prompt = `Generate structured lesson content for the GCSE OCR Computer Science subtopic: ${subtopicTitle}. Include: learning_objectives (array of strings), explanation (markdown string), key_points (array of strings), examples (array of strings), common_misconceptions (array of strings). Return as JSON.`

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      console.warn(`OpenRouter returned ${response.status} for "${subtopicTitle}", using fallback`)
      return getFallbackContent(subtopicTitle)
    }

    const data = await response.json()
    const rawContent = data?.choices?.[0]?.message?.content

    if (!rawContent) {
      console.warn(`Empty response for "${subtopicTitle}", using fallback`)
      return getFallbackContent(subtopicTitle)
    }

    // Try to parse JSON from the response
    // Handle cases where the LLM wraps JSON in markdown code blocks
    let cleaned = rawContent.trim()
    if (cleaned.startsWith('```json') || cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    }

    try {
      const parsed = JSON.parse(cleaned)
      // Validate structure
      if (!parsed.learning_objectives || !parsed.explanation || !parsed.key_points) {
        throw new Error('Missing required fields')
      }
      return {
        learning_objectives: Array.isArray(parsed.learning_objectives) ? parsed.learning_objectives : [],
        explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
        key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
        examples: Array.isArray(parsed.examples) ? parsed.examples : [],
        common_misconceptions: Array.isArray(parsed.common_misconceptions) ? parsed.common_misconceptions : [],
      }
    } catch {
      console.warn(`Failed to parse JSON for "${subtopicTitle}", using fallback`)
      return getFallbackContent(subtopicTitle)
    }
  } catch {
    console.warn(`Network error for "${subtopicTitle}", using fallback`)
    return getFallbackContent(subtopicTitle)
  }
}

function getFallbackContent(subtopicTitle: string): Record<string, unknown> {
  return {
    learning_objectives: [
      `Understand the key concepts of ${subtopicTitle}`,
      `Apply knowledge of ${subtopicTitle} to exam-style questions`,
      `Analyse and evaluate scenarios involving ${subtopicTitle}`,
    ],
    explanation: `## ${subtopicTitle}\n\nThis subtopic covers the fundamental concepts of **${subtopicTitle}** as part of the OCR GCSE Computer Science specification. Students should understand the key terminology, principles, and applications related to this area.\n\n### Overview\n\nThis area of the specification focuses on building a solid foundation of knowledge that can be applied in both Component 01 and Component 02 of the examination.`,
    key_points: [
      `${subtopicTitle} is a core topic in the OCR J277 specification`,
      `Understanding this topic is essential for exam success`,
      `Key terminology must be learned and applied correctly`,
      `Real-world examples help contextualise theoretical concepts`,
    ],
    examples: [
      `Example 1: A practical scenario related to ${subtopicTitle}`,
      `Example 2: An exam-style question applying ${subtopicTitle} concepts`,
      `Example 3: A comparison showing different aspects of ${subtopicTitle}`,
    ],
    common_misconceptions: [
      `Students often confuse related terms within ${subtopicTitle}`,
      `The practical application of ${subtopicTitle} is sometimes misunderstood`,
      `Exam questions may test nuanced understanding of ${subtopicTitle}`,
    ],
  }
}

export async function POST() {
  const supabase = await createClient()

  // Temporarily bypass auth for dev seeding — REVERT AFTER SEEDING
  await supabase.auth.getUser()
  // Auth check removed for local seeding

  const results: {
    topics_inserted: number
    subtopics_inserted: number
    subtopics_with_content: number
    errors: string[]
  } = {
    topics_inserted: 0,
    subtopics_inserted: 0,
    subtopics_with_content: 0,
    errors: [],
  }

  // 1. Check existing topics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingTopics } = await (supabase.from('topics') as any)
    .select('id, component, title')

  const existingTopicMap = new Map<string, string>()
  if (existingTopics) {
    for (const t of existingTopics as Array<{ id: string; component: string; title: string }>) {
      existingTopicMap.set(`${t.component}-${t.title}`, t.id)
    }
  }

  // 2. Insert topics
  for (const topic of TOPICS) {
    const key = `${topic.component}-${topic.title}`
    let topicId = existingTopicMap.get(key)

    if (!topicId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newTopic } = await (supabase.from('topics') as any)
        .insert({
          component: topic.component,
          title: topic.title,
          order_number: topic.order_number,
        })
        .select('id')
        .single()

      if (!newTopic) {
        results.errors.push(`Failed to insert topic ${topic.title}`)
        continue
      }
      topicId = newTopic.id
    }

    results.topics_inserted++

    // Check existing subtopics for this topic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingSubtopics } = await (supabase.from('subtopics') as any)
      .select('id, title')
      .eq('topic_id', topicId)

    const existingSubTopicMap = new Map<string, string>()
    if (existingSubtopics) {
      for (const s of existingSubtopics as Array<{ id: string; title: string }>) {
        existingSubTopicMap.set(s.title, s.id)
      }
    }

    // 3. Insert subtopics
    for (const subtopic of topic.subtopics) {
      const existingId = existingSubTopicMap.get(subtopic.title)
      let subtopicId = existingId

      if (!existingId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newSubtopic } = await (supabase.from('subtopics') as any)
          .insert({
            topic_id: topicId,
            title: subtopic.title,
            content_json: {},
            order_number: subtopic.order_number,
          })
          .select('id')
          .single()

        if (!newSubtopic) {
          results.errors.push(`Failed to insert subtopic ${subtopic.title}`)
          continue
        }
        subtopicId = newSubtopic.id
      }

      results.subtopics_inserted++

      // 4. Generate content via OpenRouter (only if content is empty)
      if (subtopicId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingSubtopic } = await (supabase.from('subtopics') as any)
          .select('content_json')
          .eq('id', subtopicId)
          .single()

        const content = existingSubtopic as Record<string, unknown> | null
        const hasContent = content && typeof content === 'object' && 'explanation' in content && content.explanation

        if (!hasContent) {
          // Wait briefly to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1500))

          const generatedContent = await generateContent(subtopic.title)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateError } = await (supabase.from('subtopics') as any)
            .update({ content_json: generatedContent })
            .eq('id', subtopicId)

          if (updateError) {
            results.errors.push(`Failed to update content for ${subtopic.title}: ${updateError.message}`)
          } else {
            results.subtopics_with_content++
          }
        } else {
          results.subtopics_with_content++
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Database seeded successfully',
    results,
  })
}
