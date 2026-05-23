import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password, fullName, role, orgSlug, orgAction, orgName, secret } = body

    if (secret !== process.env.WIPE_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabase = createServerClient(supabaseUrl, serviceKey, {
      cookies: { getAll: () => [], setAll: () => {} },
    })

    // 1. Generate placeholder email
    const placeholderEmail = `${username}@${role}.gcse.local`

    // 2. Create user in auth (auto-confirmed by admin API)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: authData, error: createError } = await (supabase.auth.admin as any).createUser({
      email: placeholderEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        username,
      },
    })

    if (createError) {
      if (createError.message?.includes('already registered') || createError.message?.includes('already in use')) {
        return NextResponse.json({ error: 'This username is already taken. Please choose another one.' }, { status: 409 })
      }
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    const userId = authData?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // 3. Create or find organization
    let organizationId: string | null = null

    if (orgAction === 'create') {
      const slug = (orgName || username).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newOrg } = await (supabase.from('organizations') as any)
        .insert({ name: orgName || `${fullName}'s School`, slug })
        .select('id')
        .single()

      if (newOrg) {
        organizationId = newOrg.id
      } else {
        // Slug collision - try with random suffix
        const suffix = Math.random().toString(36).substring(2, 6)
        const newSlug = `${slug}-${suffix}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: retryOrg } = await (supabase.from('organizations') as any)
          .insert({ name: orgName || `${fullName}'s School`, slug: newSlug })
          .select('id')
          .single()
        if (retryOrg) {
          organizationId = retryOrg.id
        }
      }
    } else if (orgSlug) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orgData } = await (supabase.from('organizations') as any)
        .select('id')
        .eq('slug', orgSlug)
        .limit(1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const foundOrg = (orgData as any[] | null)?.[0]
      if (foundOrg) {
        organizationId = foundOrg.id
      }
    }

    // 4. Update profile with username and organization_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { username }
    if (organizationId) {
      updateData.organization_id = organizationId
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from('profiles') as any)
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error('Profile update error:', updateError)
      // Don't fail - the user is created, profile might work later
    }

    return NextResponse.json({
      success: true,
      userId,
      email: placeholderEmail,
      organizationId,
    })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
