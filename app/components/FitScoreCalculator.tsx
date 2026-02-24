'use client'

import { useState, useEffect } from 'react'

interface Criterion {
  label: string
  weight: number
  description: string
}

interface Breakdown {
  label: string
  score: number
  weight: number
  weighted: number
}

interface Props {
  recruitId: string
  currentScore: number
  existingBreakdown: Record<string, Breakdown> | null
}

export default function FitScoreCalculator({ recruitId, currentScore, existingBreakdown }: Props) {
  const [criteria, setCriteria] = useState<Record<string, Criterion>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const [breakdown, setBreakdown] = useState<Record<string, Breakdown> | null>(existingBreakdown)
  const [fitScore, setFitScore] = useState(currentScore)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetchCriteria()
  }, [])

  useEffect(() => {
    if (existingBreakdown) {
      const existingScores: Record<string, number> = {}
      for (const [key, value] of Object.entries(existingBreakdown)) {
        existingScores[key] = value.score
      }
      setScores(existingScores)
    }
  }, [existingBreakdown])

  async function fetchCriteria() {
    try {
      const res = await fetch('/api/program-profile')
      const data = await res.json()
      if (data.success) {
        setCriteria(data.data.criteria)
        if (!existingBreakdown) {
          const initialScores: Record<string, number> = {}
          for (const key of Object.keys(data.data.criteria)) {
            initialScores[key] = 5
          }
          setScores(initialScores)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function handleCalculate() {
    setLoading(true)
    try {
      const res = await fetch('/api/calculate-fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruit_id: recruitId, scores }),
      })
      const data = await res.json()
      if (data.success) {
        setFitScore(data.fitScore)
        setBreakdown(data.breakdown)
        setOpen(false)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400'
    if (score >= 5) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getBarColor = (score: number) => {
    if (score >= 8) return 'bg-green-500'
    if (score >= 5) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <>
      {/* FIT SCORE CARD */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
            Program Fit Score
          </h2>
          <button
            onClick={() => setOpen(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            {breakdown ? 'Recalculate' : 'Calculate Fit'}
          </button>
        </div>

        {/* SCORE DISPLAY */}
        <div className="flex items-center gap-4 mb-4">
          <div className="text-5xl font-semibold text-blue-400">{fitScore}</div>
          <div className="flex-1">
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${fitScore}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">out of 100</p>
          </div>
        </div>

        {/* BREAKDOWN */}
        {breakdown && (
          <div className="flex flex-col gap-2 mt-4 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Score Breakdown
            </p>
            {Object.entries(breakdown)
              .sort((a, b) => b[1].weight - a[1].weight)
              .map(([key, item]) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-32 flex-shrink-0">
                    <p className="text-xs text-slate-400 truncate">{item.label}</p>
                  </div>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getBarColor(item.score)}`}
                      style={{ width: `${item.score * 10}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono font-semibold w-6 text-right ${getScoreColor(item.score)}`}>
                    {item.score}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* SCORING MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f2040] border border-white/15 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0f2040]">
              <div>
                <h2 className="font-semibold text-white">Calculate Program Fit</h2>
                <p className="text-xs text-slate-400 mt-0.5">Score each criterion from 1-10</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {Object.entries(criteria)
                .sort((a, b) => b[1].weight - a[1].weight)
                .map(([key, criterion]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-sm font-medium text-white">{criterion.label}</p>
                        <p className="text-xs text-slate-500">{criterion.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <span className="text-xs text-slate-500">Weight: {criterion.weight}</span>
                        <span className={`text-lg font-bold w-8 text-right ${getScoreColor(scores[key] || 5)}`}>
                          {scores[key] || 5}
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={scores[key] || 5}
                      onChange={e => setScores(s => ({ ...s, [key]: parseInt(e.target.value) }))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-0.5">
                      <span>1</span>
                      <span>5</span>
                      <span>10</span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 sticky bottom-0 bg-[#0f2040]">
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-slate-400 hover:text-white px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleCalculate}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Calculating...' : 'Calculate Fit Score'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}