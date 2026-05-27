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

    // Create lessons table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: tableError } = await (supabase.rpc as any)('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS lessons (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          subtopic_id UUID NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          content_json JSONB DEFAULT '{}',
          order_number INTEGER NOT NULL DEFAULT 1
        );

        ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Lessons publicly readable" ON lessons
          FOR SELECT USING (true);

        -- Add lesson_id to question_sets if not exists
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'question_sets' AND column_name = 'lesson_id'
          ) THEN
            ALTER TABLE question_sets ADD COLUMN lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `
    })

    if (tableError) {
      return NextResponse.json({ error: `SQL error: ${tableError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Lessons table created' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
