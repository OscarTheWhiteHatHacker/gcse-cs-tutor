'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type RoleType = 'student' | 'teacher' | 'setup'
type SchoolAction = 'create' | 'join'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  // Step management
  const [step, setStep] = useState(1)

  // Step 1: Role selection
  const [role, setRole] = useState<RoleType | null>(null)

  // Step 2: School info
  const [schoolAction, setSchoolAction] = useState<SchoolAction>('create')
  const [schoolName, setSchoolName] = useState('')
  const [schoolSlug, setSchoolSlug] = useState('')

  // Step 3: Personal details
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  // State
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const isStudent = role === 'student'
  const isTeacher = role === 'teacher' || role === 'setup'

  // Generate slug from name
  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleSchoolNext = () => {
    setError(null)
    if (schoolAction === 'create') {
      if (!schoolName.trim()) {
        setError('Please enter a school name')
        return
      }
    } else {
      if (!schoolSlug.trim()) {
        setError('Please enter a school code')
        return
      }
    }
    setStep(3)
  }

  const handleRoleSelect = (selectedRole: RoleType) => {
    setRole(selectedRole)
    if (selectedRole === 'student') {
      // Students go straight to school code step
      setSchoolAction('join')
    } else {
      // Teachers choose create or join
      setSchoolAction('create')
    }
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Step 1: Create organization if needed
      let orgId: string | null = null

      if (isTeacher && schoolAction === 'create') {
        const slug = slugify(schoolName)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newOrg, error: orgError } = await (supabase.from('organizations') as any)
          .insert({ name: schoolName.trim(), slug })
          .select('id')
          .single()

        if (orgError) {
          // If slug already exists, try appending random suffix
          if (orgError.message?.includes('duplicate') || orgError.code === '23505') {
            const suffix = Math.random().toString(36).substring(2, 6)
            const newSlug = `${slug}-${suffix}`
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: retryOrg, error: retryError } = await (supabase.from('organizations') as any)
              .insert({ name: schoolName.trim(), slug: newSlug })
              .select('id')
              .single()

            if (retryError) {
              setError(`Failed to create organization: ${retryError.message}`)
              setLoading(false)
              return
            }
            orgId = retryOrg.id
          } else {
            setError(`Failed to create organization: ${orgError.message}`)
            setLoading(false)
            return
          }
        } else {
          orgId = newOrg.id
        }
      } else {
        // Joining existing org or student joining by slug
        const slug = isStudent ? schoolSlug.trim() : schoolSlug.trim()
        if (!slug) {
          setError('Please enter a school code')
          setLoading(false)
          return
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orgData } = await (supabase.from('organizations') as any)
          .select('id')
          .eq('slug', slug)
          .limit(1)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const foundOrg = (orgData as any[] | null)?.[0]
        if (!foundOrg) {
          setError('School not found. Please check the code and try again.')
          setLoading(false)
          return
        }
        orgId = foundOrg.id
      }

      // Step 2: Sign up with auth
      if (isStudent) {
        // Student signup with placeholder email
        const placeholderEmail = `${username.trim()}@student.gcse.local`

        const { error: signUpError } = await supabase.auth.signUp({
          email: placeholderEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: 'student',
              username: username.trim(),
            },
            emailRedirectTo: undefined,
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          setLoading(false)
          return
        }

        // Get the newly created user
        const { data: { user: newUser } } = await supabase.auth.getUser()

        if (newUser) {
          // Update profile with organization_id (trigger already created base row)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: profileError } = await (supabase.from('profiles') as any)
            .update({
              username: username.trim(),
              organization_id: orgId,
            })
            .eq('id', newUser.id)

          if (profileError) {
            console.error('Failed to update profile:', profileError)
          }

          // Try to sign in immediately (works if email confirmation is disabled)
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: placeholderEmail,
            password,
          })

          if (!signInError) {
            router.push('/student')
            router.refresh()
            return
          }
        }

        setSuccessMessage('Account created successfully! You can now sign in.')
        setSuccess(true)
      } else {
        // Teacher signup with placeholder email (no confirmation needed)
        const placeholderEmail = `${username.trim()}@teacher.gcse.local`

        const { error: signUpError } = await supabase.auth.signUp({
          email: placeholderEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: 'teacher',
              username: username.trim(),
            },
            emailRedirectTo: undefined,
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          setLoading(false)
          return
        }

        // Get the newly created user
        const { data: { user: newUser } } = await supabase.auth.getUser()

        if (newUser) {
          // Update profile with organization_id (trigger already created base row)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: profileError } = await (supabase.from('profiles') as any)
            .update({
              username: username.trim(),
              organization_id: orgId,
            })
            .eq('id', newUser.id)

          if (profileError) {
            console.error('Failed to update profile:', profileError)
          }

          // Try to sign in immediately
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: placeholderEmail,
            password,
          })

          if (!signInError) {
            router.push('/teacher')
            router.refresh()
            return
          }
        }

        setSuccessMessage('Account created successfully! You can now sign in.')
        setSuccess(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Account created!</h1>
          <p className="mt-4 text-gray-600">{successMessage}</p>
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
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">GCSE CS Tutor</h1>
          <p className="mt-2 text-gray-600">Create your account</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === s
                    ? 'bg-indigo-600 text-white'
                    : step > s
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s
                )}
              </div>
              {s < 3 && (
                <div className={`h-0.5 w-8 ${step > s ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Step 1: Role selection */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Who are you?</h2>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleRoleSelect('student')}
                  className="w-full rounded-lg border border-gray-300 bg-white p-4 text-left transition-all hover:border-indigo-400 hover:bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                      <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">I&apos;m a student</p>
                      <p className="text-sm text-gray-500">Join a school using your school code</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleSelect('teacher')}
                  className="w-full rounded-lg border border-gray-300 bg-white p-4 text-left transition-all hover:border-indigo-400 hover:bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                      <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">I&apos;m a teacher at a school</p>
                      <p className="text-sm text-gray-500">Join or create a school for your students</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleSelect('setup')}
                  className="w-full rounded-lg border border-gray-300 bg-white p-4 text-left transition-all hover:border-indigo-400 hover:bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                      <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">I&apos;m setting up a school</p>
                      <p className="text-sm text-gray-500">Create a new school for teachers and students</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: School info */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {isStudent ? 'Join your school' : 'School information'}
              </h2>
              <p className="text-sm text-gray-500">
                {isStudent
                  ? 'Enter the school code provided by your teacher.'
                  : 'Create a new school or join an existing one.'}
              </p>

              {isTeacher ? (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setSchoolAction('create')}
                      className={`flex-1 rounded-lg border p-3 text-center text-sm font-medium transition-all ${
                        schoolAction === 'create'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Create new school
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchoolAction('join')}
                      className={`flex-1 rounded-lg border p-3 text-center text-sm font-medium transition-all ${
                        schoolAction === 'join'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Join existing school
                    </button>
                  </div>

                  {schoolAction === 'create' ? (
                    <div>
                      <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700">
                        School name
                      </label>
                      <input
                        id="schoolName"
                        type="text"
                        required
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
                        placeholder="e.g. Springfield High School"
                      />
                      {schoolName.trim() && (
                        <p className="mt-1 text-xs text-gray-500">
                          School code will be: <code className="bg-gray-100 px-1 rounded">{slugify(schoolName)}</code>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="schoolSlug" className="block text-sm font-medium text-gray-700">
                        School code
                      </label>
                      <input
                        id="schoolSlug"
                        type="text"
                        required
                        value={schoolSlug}
                        onChange={(e) => setSchoolSlug(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
                        placeholder="e.g. springfield-high"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Ask your school administrator for the code
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label htmlFor="studentSlug" className="block text-sm font-medium text-gray-700">
                    School code
                  </label>
                  <input
                    id="studentSlug"
                    type="text"
                    required
                    value={schoolSlug}
                    onChange={(e) => setSchoolSlug(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
                    placeholder="e.g. springfield-high"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Ask your teacher for the school code
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSchoolNext}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Continue
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                &larr; Back
              </button>
            </div>
          )}

          {/* Step 3: Personal details */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Your details</h2>

              {isTeacher && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    id="email"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
                    placeholder="e.g. jdoe"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This will be your username to sign in
                  </p>
                </div>
              )}

              {isStudent && (
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
                    placeholder="e.g. johndoe"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This will be used as your username to sign in
                  </p>
                </div>
              )}

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

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                &larr; Back
              </button>
            </div>
          )}

          {step === 1 && (
            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
