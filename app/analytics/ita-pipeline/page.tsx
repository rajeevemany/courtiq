'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

interface Player {
  name: string
  school: string | null
  peak_tr_ranking: number | null
  soph_rank: number | null
  junior_rank: number | null
  senior_rank: number | null
  ita_rank: number
  wins: number
  losses: number
  college: string | null
  honors: unknown
  career_summary: string | null
}

type SortKey = 'ita_rank' | 'peak_tr_ranking' | 'senior_rank' | 'wins'

function getFirstHonor(honors: unknown): string {
  if (!honors) return '—'
  if (typeof honors === 'string') return honors.split('\n')[0] || '—'
  if (typeof honors === 'object') {
    const h = honors as Record<string, string[]>
    return h.national?.[0] || h.conference?.[0] || h.regional?.[0] || '—'
  }
  return '—'
}

function rankColor(rank: number | null): string {
  if (rank == null) return 'text-slate-500'
  if (rank <= 15) return 'text-emerald-400'
  if (rank <= 30) return 'text-blue-400'
  if (rank <= 50) return 'text-amber-400'
  return 'text-slate-400'
}

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n != null)
  if (!valid.length) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}

const ITA_FILTERS = [
  { label: 'Top 10', value: 10 },
  { label: 'Top 25', value: 25 },
  { label: 'Top 50', value: 50 },
  { label: 'Top 100', value: 100 },
]

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'ITA Rank', value: 'ita_rank' },
  { label: 'TR Peak', value: 'peak_tr_ranking' },
  { label: 'Sr Rank', value: 'senior_rank' },
  { label: 'Wins', value: 'wins' },
]

export default function ITAPipelinePage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [itaFilter, setItaFilter] = useState(100)
  const [schoolFilter, setSchoolFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('ita_rank')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/analytics/ita-pipeline')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setPlayers(d)
        else setError('Failed to load data')
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return players
      .filter(p => p.ita_rank <= itaFilter)
      .filter(p => !schoolFilter || (p.college ?? '').toLowerCase().includes(schoolFilter.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'ita_rank') return a.ita_rank - b.ita_rank
        if (sortBy === 'peak_tr_ranking') return (a.peak_tr_ranking ?? 9999) - (b.peak_tr_ranking ?? 9999)
        if (sortBy === 'senior_rank') return (a.senior_rank ?? 9999) - (b.senior_rank ?? 9999)
        if (sortBy === 'wins') return (b.wins ?? 0) - (a.wins ?? 0)
        return 0
      })
  }, [players, itaFilter, schoolFilter, sortBy])

  const stats = useMemo(() => ({
    total: players.length,
    avgPeakTR: avg(players.map(p => p.peak_tr_ranking)),
    avgSoph: avg(players.map(p => p.soph_rank)),
    avgJunior: avg(players.map(p => p.junior_rank)),
    avgSenior: avg(players.map(p => p.senior_rank)),
  }), [players])

  const top25 = useMemo(() => players.filter(p => p.ita_rank <= 25), [players])
  const top25SeniorRanks = top25
    .map(p => p.senior_rank)
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b)
  const medianSenior = top25SeniorRanks.length
    ? top25SeniorRanks[Math.floor(top25SeniorRanks.length / 2)]
    : null
  const pctTop15AsSenior = top25SeniorRanks.length
    ? Math.round((top25SeniorRanks.filter(r => r <= 15).length / top25SeniorRanks.length) * 100)
    : null

  function toggleExpand(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

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
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total Players', value: String(stats.total) },
              { label: 'Avg Peak TR', value: stats.avgPeakTR != null ? `#${stats.avgPeakTR}` : '—' },
              { label: 'Avg Soph Rank', value: stats.avgSoph != null ? `#${stats.avgSoph}` : '—' },
              { label: 'Avg Jr Rank', value: stats.avgJunior != null ? `#${stats.avgJunior}` : '—' },
              { label: 'Avg Sr Rank', value: stats.avgSenior != null ? `#${stats.avgSenior}` : '—' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
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
                  itaFilter === f.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Filter by college..."
            value={schoolFilter}
            onChange={e => setSchoolFilter(e.target.value)}
            className="bg-white/5 border border-white/10 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 placeholder-slate-500 transition-colors"
          />

          <div className="flex rounded-lg border border-white/10 overflow-hidden ml-auto">
            {SORT_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => setSortBy(s.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  sortBy === s.value
                    ? 'bg-slate-700 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {!loading && (
            <span className="text-xs text-slate-500">{filtered.length} players</span>
          )}
        </div>

        {/* LOADING / ERROR */}
        {loading && (
          <div className="text-center py-20 text-slate-500 text-sm">Loading...</div>
        )}
        {error && (
          <div className="bg-red-950/40 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{error}</div>
        )}

        {/* TABLE */}
        {!loading && !error && (
          <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden mb-6">
            <div className="grid grid-cols-[60px_1fr_160px_80px_70px_70px_70px_90px_1fr] gap-3 px-5 py-3 border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <div>ITA #</div>
              <div>Player</div>
              <div>College</div>
              <div>Peak TR</div>
              <div>Soph</div>
              <div>Jr</div>
              <div>Sr</div>
              <div>Career</div>
              <div>Honors</div>
            </div>

            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center text-slate-500 text-sm">
                No players match the current filters.
              </div>
            )}

            {filtered.map((p, i) => {
              const isExpanded = expanded.has(p.name)
              const itaColor = p.ita_rank <= 10
                ? 'text-yellow-400'
                : p.ita_rank <= 25
                  ? 'text-blue-400'
                  : 'text-slate-300'

              return (
                <div key={`${p.name}-${i}`}>
                  <div className={`grid grid-cols-[60px_1fr_160px_80px_70px_70px_70px_90px_1fr] gap-3 px-5 py-3.5 border-b border-white/5 items-center hover:bg-white/3 transition-colors ${i % 2 !== 0 ? 'bg-white/[0.02]' : ''}`}>
                    <div className={`font-mono font-bold text-sm ${itaColor}`}>#{p.ita_rank}</div>
                    <div>
                      <button
                        onClick={() => toggleExpand(p.name)}
                        className="text-sm font-medium text-left hover:text-blue-300 transition-colors"
                      >
                        {p.name}
                        {p.career_summary && (
                          <span className="ml-1.5 text-xs text-slate-500">{isExpanded ? '▲' : '▼'}</span>
                        )}
                      </button>
                    </div>
                    <div className="text-sm text-slate-300 truncate">{p.college ?? '—'}</div>
                    <div className={`font-mono text-sm font-semibold ${rankColor(p.peak_tr_ranking)}`}>
                      {p.peak_tr_ranking ? `#${p.peak_tr_ranking}` : '—'}
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
                    <div className="text-xs text-slate-400 font-mono whitespace-nowrap">
                      {p.wins != null && p.losses != null ? `${p.wins}W-${p.losses}L` : '—'}
                    </div>
                    <div className="text-xs text-slate-400 truncate" title={getFirstHonor(p.honors)}>
                      {getFirstHonor(p.honors)}
                    </div>
                  </div>

                  {isExpanded && p.career_summary && (
                    <div className="px-5 py-4 bg-blue-950/20 border-b border-white/5">
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{p.career_summary}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* INSIGHT CALLOUT */}
        {!loading && !error && medianSenior != null && (
          <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-5">
            <p className="text-sm font-semibold text-amber-300 mb-1">Pipeline Insight</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              Among top-25 ITA players, the median senior year TR ranking was{' '}
              <span className="text-white font-semibold">#{medianSenior}</span>.{' '}
              {pctTop15AsSenior != null && (
                <>
                  <span className="text-white font-semibold">{pctTop15AsSenior}%</span>
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
