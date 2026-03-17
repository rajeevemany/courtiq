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

interface RankingOutcome {
  band: string
  count: number
  avgWins: number
  avgLosses: number
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

interface DiscoveryData {
  rankingOutcomes: RankingOutcome[]
  prospects: Prospect[]
  pipelineHealth: PipelineHealth
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
                  Historical Columbia commits — avg career wins & losses by recruiting rank band
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                {data.rankingOutcomes.every((r) => r.count === 0) ? (
                  <p className="text-slate-500 text-sm text-center py-8">
                    No historical Columbia commit data available yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={data.rankingOutcomes}
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                      barCategoryGap="35%"
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
                        dataKey="avgWins"
                        name="Avg Career Wins"
                        fill="#34d399"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="avgLosses"
                        name="Avg Career Losses"
                        fill="#f87171"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* Band stat pills */}
                <div className="mt-5 grid grid-cols-5 gap-3">
                  {data.rankingOutcomes.map((r) => (
                    <div
                      key={r.band}
                      className="bg-white/5 rounded-xl px-3 py-2 text-center"
                    >
                      <p className="text-xs text-slate-400 mb-0.5">Rank {r.band}</p>
                      <p className="text-white font-semibold text-sm">
                        {r.avgWins}–{r.avgLosses}
                      </p>
                      <p className="text-slate-500 text-xs">{r.count} player{r.count !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Section 2: Uncommitted Prospects Table ───────────────── */}
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
