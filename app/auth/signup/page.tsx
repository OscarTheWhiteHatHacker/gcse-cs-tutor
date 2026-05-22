'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signUpError, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setError('Failed to get user ID after signup. Please try again.')
      setLoading(false)
      return
    }

    // Handle organization logic
    try {
      if (role === 'teacher') {
        // Teacher creates a new organization
        const slug = generateSlug(schoolName || fullName + "'s School")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orgData, error: orgError } = await (supabase.from('organizations') as any)
          .insert({ name: schoolName || fullName + "'s School", slug })
          .select()
          .single()

        if (orgError) {
          console.error('Failed to create organization:', orgError)
          // Profile gets created via DB trigger, but we need to update it
        }

        const orgId = orgData?.id

        // Update profile with organization_id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: profileError } = await (supabase.from('profiles') as any)
          .update({ organization_id: orgId })
          .eq('id', userId)

        if (profileError) {
          console.error('Failed to update profile with org:', profileError)
        }
      } else {
        // Student joins an existing organization by slug
        if (!schoolCode.trim()) {
          setError('Please enter your school code.')
          setLoading(false)
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orgData, error: orgError } = await (supabase.from('organizations') as any)
          .select('id')
          .eq('slug', schoolCode.trim())
          .limit(1)

        if (orgError || !orgData || orgData.length === 0) {
          setError('School not found. Please check the code and try again.')
          setLoading(false)
          return
        }

        const orgId = orgData[0].id

        // Update profile with organization_id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: profileError } = await (supabase.from('profiles') as any)
          .update({ organization_id: orgId })
          .eq('id', userId)

        if (profileError) {
          console.error('Failed to update profile with org:', profileError)
        }
      }
    } catch (err) {
      console.error('Organization setup error:', err)
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-4 text-gray-600">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>.
            Please check your email and click the link to activate your account.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-block font-medium text-indigo-600 hover:text-indigo-500"
          >
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">GCSE CS Tutor</h1>
          <p className="mt-2 text-gray-600">Create your account</p>
        </div>

        <form onSubmit={handleSignup} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Role Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              I am a...
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 cursor-pointer hover:bg-gray-50 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={role === 'student'}
                  onChange={() => setRole('student')}
                  className="text-indigo-600"
                />
                <span className="text-sm text-gray-700">Student</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 cursor-pointer hover:bg-gray-50 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-50">
                <input
                  type="radio"
                  name="role"
                  value="teacher"
                  checked={role === 'teacher'}
                  onChange={() => setRole('teacher')}
                  className="text-indigo-600"
                />
                <span className="text-sm text-gray-700">Teacher</span>
              </label>
            </div>
          </div>

          {/* Organization Mode (only for teachers) */}
          {role === 'teacher' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Set up your school
              </label>
              <p className="text-xs text-gray-500 mb-3">
                You will create a new school. Students join using the school code generated from your school name.
              </p>
              <input
                id="schoolName"
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
                placeholder="e.g. Springfield High School"
              />
              {schoolName && (
                <p className="mt-1 text-xs text-gray-500">
                  School code: <code className="bg-gray-100 px-1 rounded">{generateSlug(schoolName)}</code>
                </p>
              )}
            </div>
          )}

          {/* School code for students */}
          {role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Join a school
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Ask your teacher for the school code.
              </p>
              <input
                id="schoolCode"
                type="text"
                required
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
                placeholder="e.g. springfield-high-school"
              />
            </div>
          )}

          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
