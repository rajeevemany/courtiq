'use client'

import { useState, useEffect, useCallback } from 'react'

interface MatchResult {
  id: string
  tournament_name: string
  tournament_grade: string | null
  surface: string | null
  round: string
  opponent_name: string
  opponent_ranking: number | null
  opponent_nationality: string | null
  opponent_itf_id: string | null
  score: string | null
  result: 'W' | 'L'
  match_date: string | null
  source: string
}

interface Props {
  recruitId: string
  recruitRanking?: number | null
}

export default function MatchResultsSection({ recruitId, recruitRanking }: Props) {
  const [results, setResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null)
  const [fetchError, setFetchError] = useState('')

  const loadResults = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/match-results?recruit_id=${recruitId}`)
      const data = await res.json()
      if (data.success) {
        console.log('match results:', data.data)
        setResults(data.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [recruitId])

  useEffect(() => { loadResults() }, [loadResults])

  async function handleFetchLatest() {
    setFetching(true)
    setFetchError('')
    setLastFetchCount(null)
    try {
      const res = await fetch('/api/match-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruit_id: recruitId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Fetch failed')
      setLastFetchCount(data.fetched)
      await loadResults()
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch results')
    } finally {
      setFetching(false)
    }
  }

  // Group by tournament name
  const grouped = results.reduce<Record<string, MatchResult[]>>((acc, m) => {
    const key = m.tournament_name || 'Unknown Tournament'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const wins   = results.filter(m => m.result === 'W').length
  const losses = results.filter(m => m.result === 'L').length

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
            Match Results
          </h2>
          {results.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {results.length} matches · <span className="text-green-400">{wins}W</span> <span className="text-red-400">{losses}L</span>
            </p>
          )}
        </div>
        <button
          onClick={handleFetchLatest}
          disabled={fetching}
          className="text-xs font-semibold px-3 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-50"
        >
          {fetching ? (
            <span className="flex items-center gap-1.5">
              <span className="animate-spin w-3 h-3 border border-blue-400/30 border-t-blue-400 rounded-full inline-block" />
              Fetching...
            </span>
          ) : '↻ Fetch Latest'}
        </button>
      </div>

      {lastFetchCount !== null && (
        <div className="mb-4 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 text-xs text-green-400">
          {lastFetchCount === 0 ? 'No new matches found' : `Fetched ${lastFetchCount} new match${lastFetchCount === 1 ? '' : 'es'}`}
        </div>
      )}

      {fetchError && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-xs text-red-400">
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-500">
          <div className="animate-spin w-5 h-5 border-2 border-white/10 border-t-blue-500 rounded-full mx-auto mb-2" />
          <p className="text-xs">Loading...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-10 text-slate-500">
          <p className="text-sm">No match results stored yet</p>
          <p className="text-xs mt-1">Click "Fetch Latest" to pull from TennisRecruiting or ITF</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {Object.entries(grouped).map(([tournament, tMatches]) => (
            <div key={tournament}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-slate-300 truncate">{tournament}</p>
                {tMatches[0]?.tournament_grade && (
                  <span className="text-xs font-mono text-blue-400 flex-shrink-0">
                    {tMatches[0].tournament_grade}
                  </span>
                )}
                {tMatches[0]?.surface && (
                  <span className="text-xs text-slate-500 flex-shrink-0">{tMatches[0].surface}</span>
                )}
                <span className="text-xs text-slate-600 flex-shrink-0 ml-auto">
                  {tMatches[0].source === 'itf' ? 'ITF' : 'TR'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {tMatches.map((m) => {
                  const isQualityWin =
                    m.result === 'W' &&
                    m.opponent_ranking != null &&
                    recruitRanking != null &&
                    m.opponent_ranking < recruitRanking
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2 bg-white/3 border border-white/5 rounded-lg"
                      style={{
                        borderLeft: m.result === 'W'
                          ? '3px solid rgba(74,222,128,0.5)'
                          : '3px solid rgba(248,113,113,0.5)',
                      }}
                    >
                      <span className={`text-xs font-bold w-4 flex-shrink-0 ${m.result === 'W' ? 'text-green-400' : 'text-red-400'}`}>
                        {m.result}
                      </span>
                      <span className="text-xs text-slate-500 w-8 flex-shrink-0">{m.round}</span>
                      <span className="flex-1 flex items-baseline gap-1 min-w-0">
                        <span className="text-white text-sm truncate">{m.opponent_name}</span>
                        {m.opponent_ranking && (
                          <span className="text-slate-400 text-xs flex-shrink-0">(#{m.opponent_ranking})</span>
                        )}
                      </span>
                      {isQualityWin && (
                        <span className="text-xs font-semibold text-yellow-400 flex-shrink-0 flex items-center gap-1">
                          ⭐ Quality Win
                        </span>
                      )}
                      {m.opponent_nationality && (
                        <span className="text-xs text-slate-500 flex-shrink-0">{m.opponent_nationality}</span>
                      )}
                      {m.score && (
                        <span className="text-xs font-mono text-slate-400 flex-shrink-0">{m.score}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
