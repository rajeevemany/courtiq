'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface TRPlayer {
  id?: string
  tennisrecruiting_id: string
  name: string
  ranking: number
  rating: string | null
  state: string | null
  committed_school: string | null
  grad_year?: number | null
  snapshot_date?: string
  previous_rank?: number
  rank_change?: number
  previous_school?: string | null
}

interface TRCommitment {
  tennisrecruiting_id: string
  name: string
  committed_school: string
  grad_year?: number | null
  state?: string | null
  rating?: string | null
  in_pipeline: boolean
  recruit_id?: string | null
}

interface SophToJuniorPlayer {
  name: string
  state: string | null
  grad_year: number | null
  tennisrecruiting_id: string | null
  soph_rank: number
  junior_rank: number
  improvement: number
  peak_ranking: number | null
}

interface MovementsData {
  rising: TRPlayer[]
  entered_top30: TRPlayer[]
  newly_uncommitted: TRPlayer[]
  top30_uncommitted: TRPlayer[]
  newly_committed: TRCommitment[]
  snapshot_dates: { current: string | null; previous: string | null }
  soph_to_junior?: SophToJuniorPlayer[]
}

function RankBadge({ ranking }: { ranking: number }) {
  const color =
    ranking <= 10
      ? 'text-yellow-300'
      : ranking <= 30
      ? 'text-yellow-400'
      : ranking <= 50
      ? 'text-slate-300'
      : 'text-slate-400'
  return <span className={`font-mono font-semibold text-sm ${color}`}>#{ranking}</span>
}

function RankChangeBadge({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
        ↑ +{change}
      </span>
    )
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
        ↓ {change}
      </span>
    )
  }
  return <span className="text-xs text-slate-500">—</span>
}

function PlayerCard({
  player,
  showPreviousSchool = false,
}: {
  player: TRPlayer
  showPreviousSchool?: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle')

  async function addToPipeline() {
    setStatus('adding')
    try {
      const res = await fetch('/api/recruits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: player.name,
          national_ranking: player.ranking,
          class_year: player.grad_year ?? new Date().getFullYear() + 1,
          location: player.state ?? '',
          status: 'Active',
          priority: player.ranking <= 30 ? 'High' : player.ranking <= 60 ? 'Medium' : 'Watch',
          notes: `TR Rating: ${player.rating ?? 'N/A'}. Added via TR Scout.`,
        }),
      })
      if (res.ok) {
        setStatus('added')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  const initials = player.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300 flex-shrink-0">
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`https://www.tennisrecruiting.net/player.asp?id=${player.tennisrecruiting_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm hover:text-blue-300 transition-colors"
          >
            {player.name}
          </a>
          {player.rank_change !== undefined && (
            <RankChangeBadge change={player.rank_change} />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <RankBadge ranking={player.ranking} />
          {player.previous_rank !== undefined && (
            <span className="text-xs text-slate-500">was #{player.previous_rank}</span>
          )}
          {player.rating && (
            <span className="text-xs text-slate-400">{player.rating}</span>
          )}
          {player.state && (
            <span className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{player.state}</span>
          )}
          {player.grad_year && (
            <span className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{player.grad_year}</span>
          )}
          {player.committed_school ? (
            <span className="text-xs text-orange-400 font-medium">→ {player.committed_school}</span>
          ) : (
            <span className="text-xs text-green-400 font-medium">Uncommitted</span>
          )}
          {showPreviousSchool && player.previous_school && (
            <span className="text-xs text-slate-500">was: {player.previous_school}</span>
          )}
        </div>
      </div>

      {/* Add to Pipeline button */}
      <button
        onClick={addToPipeline}
        disabled={status === 'adding' || status === 'added'}
        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex-shrink-0 ${
          status === 'added'
            ? 'bg-green-500/15 text-green-400 border-green-500/30 cursor-default'
            : status === 'error'
            ? 'bg-red-500/15 text-red-400 border-red-500/30'
            : status === 'adding'
            ? 'bg-white/5 text-slate-400 border-white/10 cursor-wait'
            : 'bg-white/5 text-slate-300 border-white/10 hover:bg-blue-500/10 hover:text-blue-300 hover:border-blue-500/30 cursor-pointer'
        }`}
      >
        {status === 'added'
          ? '✓ Added'
          : status === 'adding'
          ? 'Adding…'
          : status === 'error'
          ? 'Error'
          : '+ Pipeline'}
      </button>
    </div>
  )
}

function Section({
  title,
  icon,
  description,
  players,
  emptyMsg,
  showPreviousSchool = false,
  accentColor = 'blue',
  headerExtra,
  countOverride,
}: {
  title: string
  icon: string
  description: string
  players: TRPlayer[]
  emptyMsg: string
  showPreviousSchool?: boolean
  accentColor?: 'blue' | 'green' | 'yellow' | 'purple'
  headerExtra?: React.ReactNode
  countOverride?: number
}) {
  const accent = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
  }[accentColor]

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className={accent}>{icon}</span>
          <h2 className="font-semibold">{title}</h2>
          <span className="ml-auto text-xs font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
            {countOverride ?? players.length}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        {headerExtra}
      </div>

      {players.length === 0 ? (
        <div className="px-5 py-6 text-center text-slate-500 text-sm">{emptyMsg}</div>
      ) : (
        <div>
          {players.map(p => (
            <PlayerCard
              key={p.tennisrecruiting_id}
              player={p}
              showPreviousSchool={showPreviousSchool}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CommitmentCard({ player }: { player: TRCommitment }) {
  const initials = player.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-amber-900/40 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-300 flex-shrink-0">
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`https://www.tennisrecruiting.net/player.asp?id=${player.tennisrecruiting_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm hover:text-amber-300 transition-colors"
          >
            {player.name}
          </a>
          {player.in_pipeline && (
            <span className="inline-flex items-center text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
              ⚠ In Your Pipeline
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-sm font-semibold text-amber-300">→ {player.committed_school}</span>
          {player.rating && (
            <span className="text-xs text-slate-400">{player.rating}</span>
          )}
          {player.state && (
            <span className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{player.state}</span>
          )}
          {player.grad_year && (
            <span className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{player.grad_year}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function CommitmentsSection({ players }: { players: TRCommitment[] }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">✦</span>
          <h2 className="font-semibold">Newly Committed</h2>
          <span className="ml-auto text-xs font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
            {players.length}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Players who committed to a school since last capture</p>
      </div>

      {players.length === 0 ? (
        <div className="px-5 py-6 text-center text-slate-500 text-sm">
          No new commitments since last capture
        </div>
      ) : (
        <div>
          {players.map(p => (
            <CommitmentCard key={p.tennisrecruiting_id} player={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function YoYCard({ player }: { player: SophToJuniorPlayer }) {
  const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2)
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
      <div className="w-8 h-8 rounded-full bg-amber-900/40 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-300 flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {player.tennisrecruiting_id ? (
            <a
              href={`https://www.tennisrecruiting.net/player.asp?id=${player.tennisrecruiting_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm hover:text-amber-300 transition-colors"
            >
              {player.name}
            </a>
          ) : (
            <span className="font-medium text-sm">{player.name}</span>
          )}
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
            ↑ +{player.improvement}
          </span>
          {player.peak_ranking != null && (
            <span className="inline-flex items-center text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
              peak #{player.peak_ranking}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {player.state && (
            <span className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{player.state}</span>
          )}
          {player.grad_year && (
            <span className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{player.grad_year}</span>
          )}
          <span className="text-xs text-slate-500">
            Soph <span className="text-slate-400">#{player.soph_rank}</span>
            <span className="mx-1 text-slate-600">→</span>
            Jr <span className="text-slate-400">#{player.junior_rank}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function YoYSection({
  players,
  threshold,
  setThreshold,
}: {
  players: SophToJuniorPlayer[]
  threshold: number
  setThreshold: (t: number) => void
}) {
  const filtered = players.filter(p => p.improvement >= threshold)
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden xl:col-span-2">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">📈</span>
          <h2 className="font-semibold">Year-Over-Year Improvers</h2>
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2 py-0.5 rounded-full">Historical</span>
          <span className="ml-auto text-xs font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
            {filtered.length}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Players who made the biggest jump from sophomore to junior year — historical pattern of breakout trajectories</p>
        <div className="flex items-center gap-1.5 mt-3">
          {[10, 20, 30].map(t => (
            <button
              key={t}
              onClick={() => setThreshold(t)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                threshold === t
                  ? 'bg-white/15 text-white border-white/20'
                  : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
              }`}
            >
              +{t}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="px-5 py-6 text-center text-slate-500 text-sm">
          No year-over-year data yet — rankings populate as players are captured
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-white/5">
          {filtered.map((p, i) => (
            <YoYCard key={`${p.name}-${i}`} player={p} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TRScoutPage() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [risingThreshold, setRisingThreshold] = useState(5)
  const [yoyThreshold, setYoyThreshold] = useState(10)

  const [movements, setMovements] = useState<MovementsData | null>(null)
  const [loadingMovements, setLoadingMovements] = useState(true)
  const [movementsError, setMovementsError] = useState<string | null>(null)

  const loadMovements = useCallback(async () => {
    setLoadingMovements(true)
    setMovementsError(null)
    try {
      const res = await fetch('/api/tr-scout/movements')
      const data = await res.json()
      if (res.ok) {
        setMovements(data)
      } else {
        setMovementsError(data.error ?? 'Failed to load movements')
      }
    } catch (err) {
      setMovementsError(String(err))
    } finally {
      setLoadingMovements(false)
    }
  }, [])

  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">
      {/* HEADER */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-semibold tracking-tight mt-1">TR Scout</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            TennisRecruiting.net · Rankings Monitor
          </p>
        </div>

        {movements?.snapshot_dates.current && (
          <span className="text-xs text-slate-500">
            Last snapshot: {movements.snapshot_dates.current}
            {movements.snapshot_dates.previous && (
              <> · vs {movements.snapshot_dates.previous}</>
            )}
          </span>
        )}
      </div>

      <div className="px-8 py-6 max-w-7xl mx-auto">

        {/* Sources Panel */}
        <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Open Source Pages</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <button
                onClick={() => window.open('https://www.tennisrecruiting.net/list.asp?id=1275', '_blank')}
                className="w-full text-left px-4 py-3 bg-teal-500/5 border border-teal-500/25 text-teal-300 rounded-xl hover:bg-teal-500/10 transition-colors font-medium text-sm cursor-pointer"
              >
                🎾 Junior Rankings
              </button>
              <p className="text-xs text-slate-500 mt-1.5 px-1">Then use Chrome extension to capture</p>
            </div>
            <div>
              <button
                onClick={() => window.open('https://www.tennisrecruiting.net/list.asp?id=1279', '_blank')}
                className="w-full text-left px-4 py-3 bg-teal-500/5 border border-teal-500/25 text-teal-300 rounded-xl hover:bg-teal-500/10 transition-colors font-medium text-sm cursor-pointer"
              >
                📝 Junior Commitments
              </button>
              <p className="text-xs text-slate-500 mt-1.5 px-1">Then use Chrome extension to capture</p>
            </div>
            <div>
              <button
                onClick={() => window.open('https://www.tennisrecruiting.net/list.asp?id=1265', '_blank')}
                className="w-full text-left px-4 py-3 bg-blue-500/5 border border-blue-500/25 text-blue-300 rounded-xl hover:bg-blue-500/10 transition-colors font-medium text-sm cursor-pointer"
              >
                🎓 Senior Rankings
              </button>
              <p className="text-xs text-slate-500 mt-1.5 px-1">Then use Chrome extension to capture</p>
            </div>
            <div>
              <button
                onClick={() => window.open('https://www.tennisrecruiting.net/list.asp?id=1269', '_blank')}
                className="w-full text-left px-4 py-3 bg-blue-500/5 border border-blue-500/25 text-blue-300 rounded-xl hover:bg-blue-500/10 transition-colors font-medium text-sm cursor-pointer"
              >
                📋 Senior Commitments
              </button>
              <p className="text-xs text-slate-500 mt-1.5 px-1">Then use Chrome extension to capture</p>
            </div>
            <div>
              <button
                onClick={() => window.open('https://www.tennisrecruiting.net/list.asp?id=1285', '_blank')}
                className="w-full text-left px-4 py-3 bg-teal-500/5 border border-teal-500/25 text-teal-300 rounded-xl hover:bg-teal-500/10 transition-colors font-medium text-sm cursor-pointer"
              >
                📚 Sophomore Rankings
              </button>
              <p className="text-xs text-slate-500 mt-1.5 px-1">Then use Chrome extension to capture</p>
            </div>
          </div>
        </div>

        {/* Movements error */}
        {movementsError && (
          <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3">
            <p className="text-red-300 text-sm font-medium">⚠ {movementsError}</p>
          </div>
        )}

        {/* No data yet */}
        {!loadingMovements && movements?.snapshot_dates.current === null && (
          <div className="mb-5 bg-white/5 border border-white/10 rounded-xl px-5 py-6 text-center">
            <p className="text-slate-400 text-sm">No snapshots yet.</p>
            <p className="text-slate-500 text-xs mt-1">
              Click &ldquo;Fetch Latest Rankings&rdquo; to pull the current TR top 100 for each grad year.
            </p>
          </div>
        )}

        {/* Sections grid */}
        {!loadingMovements && movements && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <YoYSection
              players={movements.soph_to_junior ?? []}
              threshold={yoyThreshold}
              setThreshold={setYoyThreshold}
            />

            {(() => {
              const filteredRising = movements.rising.filter(p => (p.rank_change ?? 0) >= risingThreshold)
              return (
                <Section
                  title="Rising Fast"
                  icon="↑"
                  accentColor="green"
                  description={`Improved ${risingThreshold}+ spots since last snapshot`}
                  players={filteredRising}
                  emptyMsg="No significant movers — fetch new rankings to compare."
                  headerExtra={
                    <div className="flex items-center gap-1.5 mt-3">
                      {[5, 10, 20, 30].map(t => (
                        <button
                          key={t}
                          onClick={() => setRisingThreshold(t)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                            risingThreshold === t
                              ? 'bg-white/15 text-white border-white/20'
                              : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
                          }`}
                        >
                          +{t}
                        </button>
                      ))}
                    </div>
                  }
                />
              )
            })()}

            <Section
              title="Entered Top 30"
              icon="★"
              accentColor="yellow"
              description="Now inside top 30, previously ranked outside"
              players={movements.entered_top30}
              emptyMsg="No new entrants to the top 30."
            />

            <CommitmentsSection players={movements.newly_committed ?? []} />

            <Section
              title="Newly Uncommitted"
              icon="⚡"
              accentColor="blue"
              description="Committed school dropped off since last snapshot"
              players={movements.newly_uncommitted}
              emptyMsg="No newly uncommitted players detected."
              showPreviousSchool
            />

            <Section
              title="Top 30 Uncommitted"
              icon="◈"
              accentColor="purple"
              description="Currently ranked top 30 with no committed school"
              players={selectedYear ? movements.top30_uncommitted.filter(p => p.grad_year === selectedYear) : movements.top30_uncommitted}
              emptyMsg="All top 30 players are committed."
              countOverride={(selectedYear ? movements.top30_uncommitted.filter(p => p.grad_year === selectedYear) : movements.top30_uncommitted).length}
              headerExtra={
                <div className="flex items-center gap-1.5 mt-3">
                  {([null, 2026, 2027, 2028] as (number | null)[]).map(yr => (
                    <button
                      key={yr ?? 'all'}
                      onClick={() => setSelectedYear(yr)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                        selectedYear === yr
                          ? 'bg-white/15 text-white'
                          : 'bg-white/5 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {yr ?? 'All'}
                    </button>
                  ))}
                </div>
              }
            />
          </div>
        )}

        {loadingMovements && (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
            Loading movements…
          </div>
        )}
      </div>
    </main>
  )
}
