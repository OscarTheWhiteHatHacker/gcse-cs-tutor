import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, secret } = body

    if (secret !== process.env.WIPE_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profiles } = await (supabase.from('profiles') as any)
      .select('email')
      .eq('username', username.trim())
      .limit(1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = (profiles as any[] | null)?.[0]

    if (!profile) {
      return NextResponse.json({ found: false }, { status: 404 })
    }

    return NextResponse.json({ found: true, email: profile.email })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
