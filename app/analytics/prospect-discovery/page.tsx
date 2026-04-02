'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────

interface BandPlayer {
  name: string
  school: string
  peak_ranking: number | null
  career_singles_wins: number
  career_singles_losses: number
  peak_ita_ranking: number | null
  career_summary: string | null
}

interface RankingOutcome {
  band: string
  columbia_count: number
  columbia_avg_wins: number
  columbia_avg_losses: number
  all_count: number
  all_avg_wins: number
  all_avg_losses: number
  players: BandPlayer[]
}

interface Comparable {
  name: string
  school: string
  wins: number
  losses: number
}

interface Prospect {
  id: string
  name: string
  national_ranking: number | null
  itf_ranking: number | null
  utr: number | null
  grad_year: string | number | null
  nationality: string | null
  fit_score: number | null
  isAcademy: boolean
  comparables: Comparable[]
  comparableSummary: string | null
}

interface PipelineHealth {
  total: number
  top15: number
  band1630: number
  international: number
}

interface RisingPlayer {
  name: string
  tennisrecruiting_id: string
  current_rank: number
  previous_rank: number
  rank_change: number
  state: string | null
  grad_year: number | null
}

interface CompPlayer {
  name: string
  school: string
  peak_ranking: number
  career_singles_wins: number
  career_singles_losses: number
}

interface UndervaluedPlayer {
  name: string
  current_rank: number
  state: string | null
  grad_year: number | null
  comparable_avg_wins: number
  comparable_count: number
  comparable_players: CompPlayer[]
}

interface DiscoveryData {
  rankingOutcomes: RankingOutcome[]
  prospects: Prospect[]
  pipelineHealth: PipelineHealth
  risingPlayers: RisingPlayer[]
  undervaluedPlayers: UndervaluedPlayer[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fitColor(score: number | null) {
  if (!score) return 'text-slate-500'
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

function fitBg(score: number | null) {
  if (!score) return 'bg-slate-700'
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

// ── Custom Tooltip for bar chart ─────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d1f3c] border border-white/10 rounded-xl px-4 py-3 text-sm shadow-xl">
      <p className="text-white font-semibold mb-1">Rank {label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ProspectDiscoveryPage() {
  const [data, setData] = useState<DiscoveryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBand, setSelectedBand] = useState<string | null>(null)
  const [showColumbiaOnly, setShowColumbiaOnly] = useState(false)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [expandedUndervalued, setExpandedUndervalued] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics/prospect-discovery')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setData(json.data)
        } else {
          setError(json.error || 'Unknown error')
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Analytics</p>
          <h1 className="text-2xl font-bold tracking-tight">
            Prospect Discovery —{' '}
            <span className="text-blue-400">Columbia University</span>
          </h1>
        </div>
        <Link
          href="/"
          className="text-slate-400 hover:text-white text-sm border border-white/10 rounded-lg px-4 py-2 hover:bg-white/5 transition"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="px-8 py-8 space-y-10 max-w-7xl mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-slate-400">Loading analytics…</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-red-400 text-sm">
            Failed to load data: {error}
          </div>
        )}

        {data && (
          <>
            {/* ── Section 1: Ranking-to-Outcome Chart ─────────────────── */}
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Ranking-to-Outcome Model</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Columbia vs all schools — avg career wins & losses by recruiting rank band. Click a bar to see players.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                {data.rankingOutcomes.every((r) => r.columbia_count === 0) ? (
                  <p className="text-slate-500 text-sm text-center py-8">
                    No historical Columbia commit data available yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={data.rankingOutcomes}
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                      barCategoryGap="30%"
                      onClick={(e) => {
                        if (e?.activeLabel) {
                          setSelectedBand((prev) => {
                            const label = e.activeLabel != null ? String(e.activeLabel) : null
                            return prev === label ? null : label
                          })
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="band"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 12 }}
                      />
                      <Bar
                        dataKey="columbia_avg_wins"
                        name="Columbia Avg Wins"
                        fill="#34d399"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="columbia_avg_losses"
                        name="Columbia Avg Losses"
                        fill="#f87171"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="all_avg_wins"
                        name="All Schools Avg Wins"
                        fill="#60a5fa"
                        fillOpacity={0.6}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="all_avg_losses"
                        name="All Schools Avg Losses"
                        fill="#fb923c"
                        fillOpacity={0.6}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* Band stat pills */}
                <div className="mt-5 grid grid-cols-5 gap-3">
                  {data.rankingOutcomes.map((r) => (
                    <button
                      key={r.band}
                      onClick={() => setSelectedBand((prev) => prev === r.band ? null : r.band)}
                      className={`rounded-xl px-3 py-2 text-center transition border ${
                        selectedBand === r.band
                          ? 'bg-blue-500/20 border-blue-400/40'
                          : 'bg-white/5 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <p className="text-xs text-slate-400 mb-0.5">Rank {r.band}</p>
                      <p className="text-green-400 font-semibold text-sm">
                        COL {r.columbia_avg_wins}–{r.columbia_avg_losses}
                      </p>
                      <p className="text-blue-300/70 text-xs">
                        All {r.all_avg_wins}–{r.all_avg_losses}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {r.columbia_count} COL · {r.all_count} total
                      </p>
                    </button>
                  ))}
                </div>

                {/* Player breakdown panel */}
                {selectedBand && (() => {
                  const band = data.rankingOutcomes.find((r) => r.band === selectedBand)
                  if (!band) return null
                  const visiblePlayers = showColumbiaOnly
                    ? band.players.filter((p) => p.school === 'Columbia')
                    : band.players
                  return (
                    <div className="mt-5 border border-white/10 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
                        <div className="flex items-center gap-4">
                          <p className="text-sm font-semibold text-white">
                            Players in Rank {selectedBand}
                            <span className="ml-2 text-slate-400 font-normal">
                              ({visiblePlayers.length} player{visiblePlayers.length !== 1 ? 's' : ''})
                            </span>
                          </p>
                          {/* Toggle */}
                          <div className="flex gap-1 text-xs rounded-lg overflow-hidden border border-white/10">
                            <button
                              onClick={() => { setShowColumbiaOnly(false); setExpandedPlayer(null) }}
                              className={`px-3 py-1 transition ${!showColumbiaOnly ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                              All Schools
                            </button>
                            <button
                              onClick={() => { setShowColumbiaOnly(true); setExpandedPlayer(null) }}
                              className={`px-3 py-1 transition ${showColumbiaOnly ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                              Columbia Only
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedBand(null)}
                          className="text-slate-400 hover:text-white text-lg leading-none transition"
                        >
                          ✕
                        </button>
                      </div>
                      {visiblePlayers.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-6">
                          No players with career data in this band.
                        </p>
                      ) : (
                        <div>
                          {/* Table header */}
                          <div className="grid grid-cols-[2fr_1.5fr_80px_110px_80px_3fr_24px] gap-x-4 px-5 py-2 text-xs uppercase tracking-widest text-slate-500 font-medium border-b border-white/5">
                            <span>Name</span>
                            <span>School</span>
                            <span>Jr Rank</span>
                            <span>Career</span>
                            <span>Peak ITA</span>
                            <span>Summary</span>
                            <span />
                          </div>
                          {visiblePlayers.map((p, i) => {
                            const playerKey = `${p.name}|${p.school}`
                            const isExpanded = expandedPlayer === playerKey
                            const hasSummary = !!p.career_summary
                            return (
                              <div key={i} className={i !== visiblePlayers.length - 1 ? 'border-b border-white/5' : ''}>
                                <div
                                  onClick={() => hasSummary && setExpandedPlayer(isExpanded ? null : playerKey)}
                                  className={`grid grid-cols-[2fr_1.5fr_80px_110px_80px_3fr_24px] gap-x-4 px-5 py-3 items-center text-sm transition ${hasSummary ? 'cursor-pointer hover:bg-white/5' : 'hover:bg-white/5'}`}
                                >
                                  <span className="font-medium text-white">{p.name}</span>
                                  <span className="text-slate-300 truncate">{p.school ?? '—'}</span>
                                  <span className="text-slate-300">
                                    {p.peak_ranking != null ? `#${p.peak_ranking}` : '—'}
                                  </span>
                                  <span className="text-slate-300">
                                    <span className="text-green-400">{p.career_singles_wins}</span>
                                    <span className="text-slate-500">–</span>
                                    <span className="text-red-400">{p.career_singles_losses}</span>
                                  </span>
                                  <span className="text-slate-400">
                                    {p.peak_ita_ranking != null ? `#${p.peak_ita_ranking}` : '—'}
                                  </span>
                                  <span className="text-slate-400 text-xs truncate">
                                    {p.career_summary
                                      ? p.career_summary.length > 80
                                        ? p.career_summary.slice(0, 80) + '…'
                                        : p.career_summary
                                      : '—'}
                                  </span>
                                  <span className="text-slate-500 text-xs text-right">
                                    {hasSummary ? (isExpanded ? '▲' : '▼') : ''}
                                  </span>
                                </div>
                                {isExpanded && p.career_summary && (
                                  <div className="px-5 pb-3 pt-1 border-t border-white/5 bg-white/3">
                                    <p className="text-slate-400 text-xs italic leading-relaxed pl-2">
                                      {p.career_summary}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </section>

            {/* ── Section 2: Opportunities ─────────────────────────────── */}
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Opportunities</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Uncommitted prospects worth prioritising based on momentum and historical comparables
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Rising Fast */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-yellow-400 text-base">↑</span>
                    <h3 className="text-sm font-semibold text-yellow-300">Rising Fast</h3>
                    <span className="ml-auto text-xs text-slate-500">
                      {data.risingPlayers.length} player{data.risingPlayers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {data.risingPlayers.length === 0 ? (
                    <p className="text-slate-600 text-xs text-center py-4">
                      No significant movers in current snapshot window.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.risingPlayers.map((p) => (
                        <div
                          key={p.tennisrecruiting_id}
                          className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5"
                        >
                          <div>
                            <p className="text-white text-sm font-medium">{p.name}</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {p.state ?? '—'}{p.grad_year ? ` · ${p.grad_year}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            <span className="text-slate-400 text-xs">
                              #{p.previous_rank} → #{p.current_rank}
                            </span>
                            <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                              ↑ {p.rank_change}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Undervalued */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-purple-400 text-base">◆</span>
                    <h3 className="text-sm font-semibold text-purple-300">Undervalued</h3>
                    <span className="ml-auto text-xs text-slate-500">
                      {data.undervaluedPlayers.length} player{data.undervaluedPlayers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mb-4">
                    Comparable players historically averaged more wins than ranking suggests
                  </p>
                  {data.undervaluedPlayers.length === 0 ? (
                    <p className="text-slate-600 text-xs text-center py-4">
                      No undervalued prospects identified.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.undervaluedPlayers.map((p, i) => {
                        const isExp = expandedUndervalued === p.name
                        return (
                          <div
                            key={i}
                            className="bg-white/5 rounded-xl overflow-hidden"
                          >
                            <div
                              onClick={() => setExpandedUndervalued(isExp ? null : p.name)}
                              className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/5 transition"
                            >
                              <div>
                                <p className="text-white text-sm font-medium">{p.name}</p>
                                <p className="text-slate-500 text-xs mt-0.5">
                                  #{p.current_rank} · {p.state ?? '—'}{p.grad_year ? ` · ${p.grad_year}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 text-right">
                                <div>
                                  <span className="bg-purple-500/20 text-purple-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                                    Comps avg {p.comparable_avg_wins}w
                                  </span>
                                  <p className="text-slate-600 text-xs mt-1">
                                    {p.comparable_count} comp{p.comparable_count !== 1 ? 's' : ''}
                                  </p>
                                </div>
                                <span className="text-slate-500 text-xs">{isExp ? '▲' : '▼'}</span>
                              </div>
                            </div>
                            {isExp && (
                              <div className="border-t border-white/5 px-4 py-3">
                                <div className="grid grid-cols-[2fr_1.5fr_70px_90px] gap-x-3 text-xs uppercase tracking-widest text-slate-600 font-medium pb-1.5 mb-1 border-b border-white/5">
                                  <span>Name</span>
                                  <span>School</span>
                                  <span>Rank</span>
                                  <span>Record</span>
                                </div>
                                {p.comparable_players.map((c, j) => (
                                  <div
                                    key={j}
                                    className="grid grid-cols-[2fr_1.5fr_70px_90px] gap-x-3 text-xs py-1.5 items-center"
                                  >
                                    <span className="text-slate-300 truncate">{c.name}</span>
                                    <span className="text-slate-400 truncate">{c.school}</span>
                                    <span className="text-slate-400">#{c.peak_ranking}</span>
                                    <span>
                                      <span className="text-green-400">{c.career_singles_wins}</span>
                                      <span className="text-slate-600">–</span>
                                      <span className="text-red-400">{c.career_singles_losses}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Section 3: Uncommitted Prospects Table ───────────────── */}
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Uncommitted Prospects</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Top 30 US ranking or ITF top 200 — sorted by fit score
                </p>
              </div>

              {data.prospects.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-slate-500 text-sm">
                  No uncommitted prospects matching Columbia&apos;s criteria found.
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[2fr_80px_80px_2fr_90px_2fr] gap-x-4 px-5 py-3 border-b border-white/10 text-xs uppercase tracking-widest text-slate-500 font-medium">
                    <span>Name</span>
                    <span>TR Rank</span>
                    <span>Country</span>
                    <span>Class</span>
                    <span>Fit</span>
                    <span>Comparable Outcomes</span>
                  </div>

                  {/* Rows */}
                  {data.prospects.map((p, i) => (
                    <div
                      key={p.id}
                      className={`grid grid-cols-[2fr_80px_80px_2fr_90px_2fr] gap-x-4 px-5 py-4 items-center text-sm ${
                        i !== data.prospects.length - 1 ? 'border-b border-white/5' : ''
                      } hover:bg-white/5 transition`}
                    >
                      {/* Name */}
                      <span className="font-medium text-white">{p.name}</span>

                      {/* TR Rank */}
                      <span className="text-slate-300">
                        {p.national_ranking != null ? `#${p.national_ranking}` : '—'}
                        {p.itf_ranking != null && p.national_ranking == null && (
                          <span className="text-slate-500 text-xs ml-1">ITF#{p.itf_ranking}</span>
                        )}
                      </span>

                      {/* Country */}
                      <span className="text-slate-400">{p.nationality ?? '—'}</span>

                      {/* Class year + academy flag */}
                      <span className="flex items-center gap-1.5">
                        <span className={p.isAcademy ? 'text-yellow-300' : 'text-slate-300'}>
                          {p.grad_year ?? '—'}
                        </span>
                        {p.isAcademy && (
                          <span
                            title="Tennis academy — not a traditional school"
                            className="text-yellow-400 text-base leading-none"
                          >
                            ⚠
                          </span>
                        )}
                      </span>

                      {/* Fit score */}
                      <span>
                        {p.fit_score != null ? (
                          <span className="flex items-center gap-2">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${fitBg(p.fit_score)} text-[#0a1628]`}
                            >
                              {p.fit_score}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">N/A</span>
                        )}
                      </span>

                      {/* Comparable outcomes */}
                      <span>
                        {p.comparableSummary ? (
                          <span className="text-slate-300 text-xs">
                            {p.comparableSummary}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">No comparable data</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Section 3: Pipeline Health ───────────────────────────── */}
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Pipeline Health</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Current prospect distribution across target zones
                </p>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {/* Total */}
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5">
                  <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Total Prospects</p>
                  <p className="text-4xl font-bold text-white">{data.pipelineHealth.total}</p>
                  <p className="text-slate-500 text-xs mt-1">uncommitted, in target range</p>
                </div>

                {/* Top 15 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5 border-l-4 border-l-green-500">
                  <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Top 15 US</p>
                  <p className="text-4xl font-bold text-green-400">{data.pipelineHealth.top15}</p>
                  <p className="text-slate-500 text-xs mt-1">elite tier prospects</p>
                  <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{
                        width: data.pipelineHealth.total
                          ? `${(data.pipelineHealth.top15 / data.pipelineHealth.total) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>

                {/* 16–30 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5 border-l-4 border-l-blue-400">
                  <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Rank 16–30 US</p>
                  <p className="text-4xl font-bold text-blue-400">{data.pipelineHealth.band1630}</p>
                  <p className="text-slate-500 text-xs mt-1">solid-tier prospects</p>
                  <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all"
                      style={{
                        width: data.pipelineHealth.total
                          ? `${(data.pipelineHealth.band1630 / data.pipelineHealth.total) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>

                {/* International */}
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-5 border-l-4 border-l-purple-400">
                  <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">International</p>
                  <p className="text-4xl font-bold text-purple-400">{data.pipelineHealth.international}</p>
                  <p className="text-slate-500 text-xs mt-1">ITF top 200, no US rank</p>
                  <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-400 rounded-full transition-all"
                      style={{
                        width: data.pipelineHealth.total
                          ? `${(data.pipelineHealth.international / data.pipelineHealth.total) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Academy warning summary */}
              {data.prospects.some((p) => p.isAcademy) && (
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-3 flex items-start gap-3 text-sm">
                  <span className="text-yellow-400 text-lg mt-0.5">⚠</span>
                  <p className="text-yellow-300">
                    <span className="font-semibold">
                      {data.prospects.filter((p) => p.isAcademy).length} prospect
                      {data.prospects.filter((p) => p.isAcademy).length > 1 ? 's' : ''}
                    </span>{' '}
                    {data.prospects.filter((p) => p.isAcademy).length > 1 ? 'are' : 'is'} from a
                    tennis academy. Columbia prefers players from traditional schools —
                    flag for additional evaluation.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
