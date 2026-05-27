'use client'

import { useState } from 'react'

interface Question {
  question: string
  marks: number
  mark_scheme: string
}

interface AssignQuestionsButtonProps {
  subtopicId: string
  lessonIndex?: number
}

export default function AssignQuestionsButton({ subtopicId, lessonIndex }: AssignQuestionsButtonProps) {
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [error, setError] = useState('')
  const [showReview, setShowReview] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setShowReview(false)
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtopicId, lessonIndex }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to generate questions')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsedQuestions = (data.questionSet?.questions_json || []) as any[]
      setQuestions(parsedQuestions as Question[])
      setShowReview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating questions...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Assign Questions
          </>
        )}
      </button>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-medium text-red-800">Error generating questions</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      {showReview && questions.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Generated Questions ({questions.length})
          </h3>
          <p className="text-sm text-green-700">
            Questions have been saved and assigned to students.
          </p>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-semibold text-gray-900">Question {i + 1}</h4>
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                    {q.marks} mark{q.marks !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{q.question}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-800">
                    View mark scheme
                  </summary>
                  <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap border-t border-gray-100 pt-2">
                    {q.mark_scheme}
                  </p>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {showReview && questions.length === 0 && !error && (
        <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-800">
            Questions were saved but could not be displayed for review. Check the question sets page to view them.
          </p>
        </div>
      )}
    </div>
  )
}
