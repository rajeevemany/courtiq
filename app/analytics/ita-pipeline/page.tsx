'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

interface Player {
  ita_rank: number
  season: string
  player_name: string
  school: string | null
  tr_peak_ranking: number | null
  soph_rank: number | null
  junior_rank: number | null
  senior_rank: number | null
  committed_school: string | null
  itf_ranking: number | null
  nationality: string | null
  matched: boolean
}

interface ApiResponse {
  seasons: string[]
  players: Player[]
}

type SortKey = 'ita_rank' | 'tr_peak_ranking' | 'senior_rank'

const ITA_FILTERS = [
  { label: 'Top 25',  value: 25  },
  { label: 'Top 50',  value: 50  },
  { label: 'Top 100', value: 100 },
  { label: 'Top 125', value: 125 },
]

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'ITA Rank', value: 'ita_rank'        },
  { label: 'TR Peak',  value: 'tr_peak_ranking'  },
  { label: 'Sr Rank',  value: 'senior_rank'      },
]

function rankColor(rank: number | null): string {
  if (rank == null) return 'text-slate-500'
  if (rank <= 15)   return 'text-emerald-400'
  if (rank <= 30)   return 'text-blue-400'
  if (rank <= 50)   return 'text-amber-400'
  return 'text-slate-400'
}

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n != null)
  if (!valid.length) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}

export default function ITAPipelinePage() {
  const [data, setData]               = useState<ApiResponse | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [selectedSeason, setSelectedSeason] = useState('2025-26')
  const [itaFilter, setItaFilter]     = useState(100)
  const [matchedOnly, setMatchedOnly] = useState(false)
  const [sortBy, setSortBy]           = useState<SortKey>('ita_rank')

  useEffect(() => {
    fetch('/api/analytics/ita-pipeline', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.players && d.seasons) {
          setData(d)
          if (d.seasons.length > 0) setSelectedSeason(d.seasons[0])
        } else {
          setError('Failed to load data')
        }
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.players
      .filter(p => selectedSeason === 'all' || p.season === selectedSeason)
      .filter(p => p.ita_rank <= itaFilter)
      .filter(p => !matchedOnly || p.matched)
      .sort((a, b) => {
        if (sortBy === 'ita_rank')        return a.ita_rank - b.ita_rank
        if (sortBy === 'tr_peak_ranking') return (a.tr_peak_ranking ?? 9999) - (b.tr_peak_ranking ?? 9999)
        if (sortBy === 'senior_rank')     return (a.senior_rank ?? 9999) - (b.senior_rank ?? 9999)
        return 0
      })
  }, [data, selectedSeason, itaFilter, matchedOnly, sortBy])

  const stats = useMemo(() => {
    const matched = filtered.filter(p => p.matched)
    return {
      total:       filtered.length,
      matchedCount: matched.length,
      matchedPct:  filtered.length ? Math.round((matched.length / filtered.length) * 100) : 0,
      avgPeakTR:   avg(matched.map(p => p.tr_peak_ranking)),
      avgSenior:   avg(matched.map(p => p.senior_rank)),
    }
  }, [filtered])

  // Insight: top-25 matched players in selected season
  const top25SeniorRanks = useMemo(() => {
    if (!data) return []
    return data.players
      .filter(p => (selectedSeason === 'all' || p.season === selectedSeason) && p.ita_rank <= 25 && p.matched)
      .map(p => p.senior_rank)
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b)
  }, [data, selectedSeason])

  const medianSenior = top25SeniorRanks.length
    ? top25SeniorRanks[Math.floor(top25SeniorRanks.length / 2)]
    : null
  const pctTop15 = top25SeniorRanks.length
    ? Math.round((top25SeniorRanks.filter(r => r <= 15).length / top25SeniorRanks.length) * 100)
    : null

  const seasons = data?.seasons ?? []

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">

      {/* HEADER */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors text-sm">
          ← Dashboard
        </Link>
        <span className="text-white/20">/</span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">🏆 ITA Pipeline Analysis</h1>
          <p className="text-sm text-slate-400 mt-0.5">What did top-100 ITA college players look like as juniors?</p>
        </div>
      </div>

      <div className="px-8 py-6 max-w-7xl mx-auto">

        {/* SUMMARY STATS */}
        {!loading && !error && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Ranked',    value: String(stats.total) },
              { label: 'Matched to TR',   value: `${stats.matchedCount} (${stats.matchedPct}%)` },
              { label: 'Avg Peak TR',     value: stats.avgPeakTR  != null ? `#${stats.avgPeakTR}`  : '—' },
              { label: 'Avg Senior TR',   value: stats.avgSenior  != null ? `#${stats.avgSenior}`  : '—' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* SEASON TABS */}
        {!loading && seasons.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setSelectedSeason('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedSeason === 'all' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            {seasons.map(s => (
              <button
                key={s}
                onClick={() => setSelectedSeason(s)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectedSeason === s ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {ITA_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setItaFilter(f.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  itaFilter === f.value ? 'bg-blue-600/80 text-white' : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setMatchedOnly(!matchedOnly)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              matchedOnly
                ? 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {matchedOnly ? '✓ TR Matched Only' : 'TR Matched Only'}
          </button>

          <div className="flex rounded-lg border border-white/10 overflow-hidden ml-auto">
            {SORT_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => setSortBy(s.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  sortBy === s.value ? 'bg-slate-700 text-white' : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {!loading && <span className="text-xs text-slate-500">{filtered.length} players</span>}
        </div>

        {/* LOADING / ERROR */}
        {loading && <div className="text-center py-20 text-slate-500 text-sm">Loading...</div>}
        {error && <div className="bg-red-950/40 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

        {/* TABLE */}
        {!loading && !error && (
          <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden mb-6">
            <div className="grid grid-cols-[60px_1fr_180px_80px_70px_70px_70px_90px] gap-3 px-5 py-3 border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <div>ITA #</div>
              <div>Player</div>
              <div>College</div>
              <div>Peak TR</div>
              <div>Soph</div>
              <div>Jr</div>
              <div>Sr</div>
              <div>Matched?</div>
            </div>

            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center text-slate-500 text-sm">No players match the current filters.</div>
            )}

            {filtered.map((p, i) => {
              const itaColor = p.ita_rank <= 10
                ? 'text-yellow-400'
                : p.ita_rank <= 25
                  ? 'text-blue-400'
                  : 'text-slate-300'

              return (
                <div
                  key={`${p.player_name}-${p.season}-${i}`}
                  className={`grid grid-cols-[60px_1fr_180px_80px_70px_70px_70px_90px] gap-3 px-5 py-3.5 border-b border-white/5 items-center hover:bg-white/3 transition-colors ${i % 2 !== 0 ? 'bg-white/[0.02]' : ''}`}
                >
                  <div className={`font-mono font-bold text-sm ${itaColor}`}>#{p.ita_rank}</div>
                  <div className="text-sm font-medium truncate">{p.player_name}</div>
                  <div className="text-sm text-slate-300 truncate">{p.school ?? '—'}</div>

                  {p.matched ? (
                    <>
                      <div className={`font-mono text-sm font-semibold ${rankColor(p.tr_peak_ranking)}`}>
                        {p.tr_peak_ranking ? `#${p.tr_peak_ranking}` : '—'}
                      </div>
                      <div className={`font-mono text-sm ${rankColor(p.soph_rank)}`}>
                        {p.soph_rank ? `#${p.soph_rank}` : '—'}
                      </div>
                      <div className={`font-mono text-sm ${rankColor(p.junior_rank)}`}>
                        {p.junior_rank ? `#${p.junior_rank}` : '—'}
                      </div>
                      <div className={`font-mono text-sm ${rankColor(p.senior_rank)}`}>
                        {p.senior_rank ? `#${p.senior_rank}` : '—'}
                      </div>
                      <div className="text-xs text-emerald-400 font-medium">✓ Matched</div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-4 flex items-center gap-2">
                        {p.itf_ranking != null ? (
                          <>
                            <span className="text-xs text-blue-400 font-medium">
                              🌍 ITF #{p.itf_ranking}
                            </span>
                            {p.nationality && (
                              <span className="text-xs text-slate-500">{p.nationality}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">🌍 International</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">—</div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* INSIGHT */}
        {!loading && !error && medianSenior != null && (
          <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-5">
            <p className="text-sm font-semibold text-amber-300 mb-1">Pipeline Insight</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              Among top-25 ITA players in{' '}
              <span className="text-white font-semibold">
                {selectedSeason === 'all' ? 'all seasons' : selectedSeason}
              </span>
              , the median senior year TR ranking was{' '}
              <span className="text-white font-semibold">#{medianSenior}</span>.{' '}
              {pctTop15 != null && (
                <>
                  <span className="text-white font-semibold">{pctTop15}%</span>
                  {' '}were ranked in the top&nbsp;15 nationally as seniors.
                </>
              )}
            </p>
          </div>
        )}

      </div>
    </main>
  )
}
