import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if ((profile as Database['public']['Tables']['profiles']['Row'] | null)?.role === 'teacher') {
    redirect('/teacher')
  } else if ((profile as Database['public']['Tables']['profiles']['Row'] | null)?.role === 'student') {
    redirect('/student')
  }

  redirect('/auth/login')
}
