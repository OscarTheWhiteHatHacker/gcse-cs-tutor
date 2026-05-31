import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { secret } = body

    if (secret !== process.env.WIPE_SECRET) {
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

    // Add teacher_feedback column if it doesn't exist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err1 } = await (supabase.rpc as any)('exec_sql', {
      sql: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS teacher_feedback TEXT DEFAULT '';"
    })
    if (err1) {
      // rpc might not exist, try raw query approach
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: err2 } = await (supabase.from('profiles') as any)
        .update({ teacher_feedback: '' })
        .eq('id', '00000000-0000-0000-0000-000000000000')
      // if that didn't error, the column exists
      if (err2 && err2.message?.includes('column')) {
        // Column doesn't exist - can't add it this way
        return NextResponse.json({ 
          error: 'Column does not exist and cannot be added via API. Run SQL manually in Supabase dashboard.',
          details: err2.message
        }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Migration check complete' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
