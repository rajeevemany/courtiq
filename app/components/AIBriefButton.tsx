'use client'

import { useState } from 'react'

interface Props {
  recruitId: string
  existingBrief: string | null
  existingBriefDate: string | null
}

export default function AIBriefButton({ recruitId, existingBrief, existingBriefDate }: Props) {
  const [brief, setBrief] = useState<string | null>(existingBrief)
  const [briefDate, setBriefDate] = useState<string | null>(existingBriefDate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateBrief() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruit_id: recruitId }),
      })

      const data = await res.json()

      if (!data.success) throw new Error(data.error)

      setBrief(data.brief)
      setBriefDate(new Date().toISOString())
    } catch (err) {
      console.error(err)
      setError('Failed to generate brief. Check your OpenAI API key.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-sm">✦</span>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-blue-400">
            AI Brief
          </h2>
        </div>
        <button
          onClick={generateBrief}
          disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? 'Generating...' : brief ? 'Regenerate' : 'Generate Brief'}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {!brief && !loading && !error && (
        <p className="text-sm text-slate-400 leading-relaxed">
          Click Generate Brief to create an AI-powered summary synthesizing all notes,
          interactions, and ranking data into a coach-ready brief.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-2">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Analyzing recruit data...</p>
        </div>
      )}

      {brief && !loading && (
        <>
          <p className="text-sm text-slate-300 leading-relaxed">{brief}</p>
          {briefDate && (
            <p className="text-xs text-slate-500 mt-3">
              Generated {new Date(briefDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          )}
        </>
      )}
    </div>
  )
}