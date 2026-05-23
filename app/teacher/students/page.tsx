'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Student {
  id: string
  full_name: string
  username: string | null
  email: string
}

export default function ManageStudentsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadStudents()
  }, [])

  async function loadStudents() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Get teacher's org
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('organization_id')
      .eq('id', user.id)
      .limit(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teacherProfile = (profile as any[] | null)?.[0]
    if (!teacherProfile?.organization_id) {
      setLoading(false)
      return
    }

    setOrgId(teacherProfile.organization_id)

    // Fetch students in same org
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: studentData } = await (supabase.from('profiles') as any)
      .select('id, full_name, username, email')
      .eq('role', 'student')
      .eq('organization_id', teacherProfile.organization_id)
      .order('full_name', { ascending: true })

    setStudents((studentData || []) as Student[])
    setLoading(false)
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          secret: 'wipe-my-data-2026',
          orgId,
          username: newUsername.trim(),
          password: newPassword,
          fullName: newFullName.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create student')
        setSubmitting(false)
        return
      }

      setSuccess(`Student "${newFullName.trim()}" created successfully!`)
      setShowAddForm(false)
      setNewUsername('')
      setNewFullName('')
      setNewPassword('')
      loadStudents()
    } catch {
      setError('Failed to create student')
    }
    setSubmitting(false)
  }

  async function handleEditStudent(studentId: string) {
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          secret: 'wipe-my-data-2026',
          studentId,
          fullName: editName.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to update student')
        setSubmitting(false)
        return
      }

      setSuccess('Student updated successfully!')
      setEditingId(null)
      setEditName('')
      loadStudents()
    } catch {
      setError('Failed to update student')
    }
    setSubmitting(false)
  }

  async function handleDeleteStudent(studentId: string, studentName: string) {
    if (!confirm(`Are you sure you want to delete "${studentName}"? This cannot be undone.`)) {
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          secret: 'wipe-my-data-2026',
          studentId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete student')
        setSubmitting(false)
        return
      }

      setSuccess(`Student "${studentName}" deleted.`)
      loadStudents()
    } catch {
      setError('Failed to delete student')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading students...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Students</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create, edit, and remove student accounts in your school.
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setError(null); setSuccess(null) }}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Student'}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>
      )}

      {/* Add Student Form */}
      {showAddForm && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Student</h2>
          <form onSubmit={handleAddStudent} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
                placeholder="e.g. johndoe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full name</label>
              <input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm text-gray-900"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Student'}
            </button>
          </form>
        </div>
      )}

      {/* Students Table */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        {students.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-gray-700">No students yet</h3>
            <p className="mt-2 text-sm text-gray-500">
              Click &quot;+ Add Student&quot; to create your first student account.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === student.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => handleEditStudent(student.id)}
                          disabled={submitting}
                          className="text-sm font-medium text-green-600 hover:text-green-800"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-sm font-medium text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{student.full_name}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.username || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => { setEditingId(student.id); setEditName(student.full_name); setError(null); setSuccess(null) }}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteStudent(student.id, student.full_name)}
                      disabled={submitting}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
