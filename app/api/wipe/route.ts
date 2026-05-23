import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const TABLES = ['student_answers', 'question_sets', 'released_subtopics', 'profiles', 'organizations']

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (body.secret !== process.env.WIPE_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabase = createServerClient(supabaseUrl, serviceKey, {
      cookies: { getAll: () => [], setAll: () => {} },
    })

    const results: Record<string, string> = {}

    // 1. Delete rows from public tables
    for (const table of TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error, count } = await (supabase.from(table) as any)
        .delete({ count: 'exact' })
        .neq('id', '00000000-0000-0000-0000-000000000000')

      results[table] = error ? `Error: ${error.message}` : `Deleted ${count ?? 'all'} rows`
    }

    // 2. Delete auth users (auth.users)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let deletedUsers = 0
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: usersData, error: listError } = await (supabase.auth.admin as any).listUsers()
      if (!listError && usersData?.users) {
        for (const user of usersData.users) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: delError } = await (supabase.auth.admin as any).deleteUser(user.id)
          if (!delError) deletedUsers++
        }
      }
      results['auth.users'] = `Deleted ${deletedUsers} users`
    } catch (err) {
      results['auth.users'] = `Error: ${err instanceof Error ? err.message : 'Failed to list users'}`
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
