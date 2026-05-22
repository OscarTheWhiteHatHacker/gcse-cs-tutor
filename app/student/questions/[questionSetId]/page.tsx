'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Question {
  question: string
  marks: number
  mark_scheme: string
}

interface MarkedAnswer {
  questionIndex: number
  score: number
  feedback: string
  suggestions: string
}

interface SubmitResult {
  success: boolean
  result: Record<string, unknown>
  markedAnswers: MarkedAnswer[]
  totalScore: number
}

export default function StudentQuestionSetPage({
  params,
}: {
  params: { questionSetId: string }
}) {
  const searchParams = useSearchParams()
  const viewResults = searchParams.get('view') === 'results'

  const [questions, setQuestions] = useState<Question[]>([])
  const [subtopicTitle, setSubtopicTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        if (viewResults) {
          // Load existing results
          const resp = await fetch(`/api/student-answers?questionSetId=${params.questionSetId}`)
          if (!resp.ok) {
            const err = await resp.json()
            throw new Error(err.error || 'Failed to load results')
          }
          const data = await resp.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const qs = (data.questions || []) as any[]
          setQuestions(qs as Question[])
          setSubtopicTitle(data.subtopicTitle || '')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const savedAnswers = (data.answer?.answers_json || []) as any[]
          setAnswers(savedAnswers.map((a: { answer?: string }) => a.answer || ''))
          setResult({
            success: true,
            result: data.answer,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            markedAnswers: data.answer?.feedback_json as any[] || [],
            totalScore: data.answer?.total_score || 0,
          })
          setSubmitted(true)
        } else {
          // Load questions for answering
          const resp = await fetch(`/api/question-set?id=${params.questionSetId}`)
          if (!resp.ok) {
            const err = await resp.json()
            throw new Error(err.error || 'Failed to load question set')
          }
          const data = await resp.json()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const qs = (data.questionSet?.questions_json || []) as any[]
          setQuestions(qs as Question[])
          setSubtopicTitle(data.subtopicTitle || '')
          setAnswers(new Array(qs.length).fill(''))
        }
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
        setLoading(false)
      }
    }
    loadData()
  }, [params.questionSetId, viewResults])

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers]
    newAnswers[index] = value
    setAnswers(newAnswers)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const answerPayload = questions.map((_, i) => ({
        questionIndex: i,
        answer: answers[i] || '',
      }))

      const response = await fetch('/api/mark-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionSetId: params.questionSetId,
          answers: answerPayload,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to submit answers')
      }

      const data = await response.json()
      setResult(data)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-sm text-gray-500">Loading questions...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-800">Error</h2>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <Link href="/student/questions" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-800">
          &larr; Back to question sets
        </Link>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
        <h2 className="text-lg font-semibold text-gray-700">No questions found</h2>
        <p className="mt-2 text-sm text-gray-500">This question set appears to be empty.</p>
        <Link href="/student/questions" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-800">
          &larr; Back to question sets
        </Link>
      </div>
    )
  }

  // Show results after submission or from existing data
  if (submitted && result) {
    const maxTotal = questions.reduce((sum, q) => sum + q.marks, 0)
    return (
      <div className="space-y-6">
        <div>
          <Link href="/student/questions" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            &larr; Back to question sets
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Results</h1>
          {subtopicTitle && (
            <p className="mt-1 text-sm text-gray-500">{subtopicTitle}</p>
          )}
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold ${
              result.totalScore >= maxTotal * 0.7
                ? 'bg-green-100 text-green-700'
                : result.totalScore >= maxTotal * 0.4
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {result.totalScore}/{maxTotal}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Your Score</h2>
              <p className="text-sm text-gray-500">
                {result.totalScore >= maxTotal * 0.7
                  ? 'Great work! Keep it up.'
                  : result.totalScore >= maxTotal * 0.4
                  ? 'Good effort, but there is room for improvement.'
                  : 'Keep practising, you will get there!'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {result.markedAnswers.map((marked, i) => {
            const q = questions[i]
            if (!q) return null
            return (
              <div key={i} className="rounded-lg border bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-semibold text-gray-900">Question {i + 1}</h3>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    marked.score >= q.marks * 0.7
                      ? 'bg-green-100 text-green-800'
                      : marked.score >= q.marks * 0.4
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {marked.score}/{q.marks}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{q.question}</p>
                <div className="mt-3 rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Your answer:</p>
                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{answers[i] || '(no answer)'}</p>
                </div>
                <div className="mt-3 rounded-md bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-600">Feedback:</p>
                  <p className="mt-1 text-sm text-blue-800">{marked.feedback}</p>
                </div>
                {marked.suggestions && marked.suggestions !== 'N/A' && (
                  <div className="mt-2 rounded-md bg-purple-50 p-3">
                    <p className="text-xs font-medium text-purple-600">Suggestions:</p>
                    <p className="mt-1 text-sm text-purple-800">{marked.suggestions}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="text-center">
          <Link
            href="/student/questions"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to question sets
          </Link>
        </div>
      </div>
    )
  }

  // Show questions for answering
  return (
    <div className="space-y-6">
      <div>
        <Link href="/student/questions" className="text-sm font-medium text-blue-600 hover:text-blue-800">
          &larr; Back to question sets
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Practice Questions</h1>
        {subtopicTitle && (
          <p className="mt-1 text-sm text-gray-500">{subtopicTitle}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          {questions.length} question{questions.length !== 1 ? 's' : ''} &middot; Total marks: {questions.reduce((sum, q) => sum + q.marks, 0)}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {questions.map((q, i) => (
          <div key={i} className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold text-gray-900">Question {i + 1}</h3>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                {q.marks} mark{q.marks !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-700">{q.question}</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your answer:
              </label>
              <textarea
                value={answers[i] || ''}
                onChange={(e) => handleAnswerChange(i, e.target.value)}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Type your answer here..."
                disabled={submitting}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          {answers.filter((a) => a.trim().length > 0).length} of {questions.length} questions answered
        </p>
        <button
          onClick={handleSubmit}
          disabled={submitting || answers.every((a) => a.trim().length === 0)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Marking your answers...
            </>
          ) : (
            'Submit Answers'
          )}
        </button>
      </div>
    </div>
  )
}
