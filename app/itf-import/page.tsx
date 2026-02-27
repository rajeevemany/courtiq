'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

const ALLOWED_NATIONALITIES = new Set([
  'USA','GBR','AUS','CAN','NZL','IRL','RSA','BAH',
  'SUI','SWE','NOR','DEN','NED','GER','AUT','FIN','BEL',
  'IND','HKG','SGP','HUN','SVK','ESP','FRA','ITA',
])

const ITF_URL = 'https://www.itftennis.com/tennis/api/PlayerRankApi/GetPlayerRankings?circuitCode=JT&playerTypeCode=B&ageCategoryCode=&juniorRankingType=itf&take=500&skip=0&isOrderAscending=true'

// Threshold values: -1 = no filter, otherwise filter to rankMovement <= -threshold
const MOVEMENT_OPTIONS = [
  { label: 'Any movement',  value: -1  },
  { label: 'Moved up 5+',   value: 5   },
  { label: 'Moved up 10+',  value: 10  },
  { label: 'Moved up 20+',  value: 20  },
  { label: 'Moved up 30+',  value: 30  },
]

interface ITFPlayer {
  playerId: string
  playerFamilyName: string
  playerGivenName: string
  playerNationalityCode: string
  playerNationality: string
  birthYear: number
  rank: number
  rankMovement: number
  tournamentsPlayed: number
  points: number
  profileLink: string
}

type FetchStatus = 'idle' | 'fetching' | 'fetched' | 'error'

export default function ITFImportPage() {
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle')
  const [allPlayers, setAllPlayers] = useState<ITFPlayer[]>([])
  const [totalFetched, setTotalFetched] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  // Filter controls — default to "Moved up 10+"
  const [countryFilter, setCountryFilter]       = useState('all')
  const [birthYearFilter, setBirthYearFilter]   = useState('all')
  const [movementThreshold, setMovementThreshold] = useState(10)

  // Per-player add state
  const [added,  setAdded]  = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<Set<string>>(new Set())

  // --- Derived filter option lists ---
  const countries = useMemo(() => {
    const seen = new Set<string>()
    allPlayers.forEach(p => seen.add(p.playerNationalityCode))
    return Array.from(seen).sort()
  }, [allPlayers])

  const birthYears = useMemo(() => {
    const seen = new Set<number>()
    allPlayers.forEach(p => seen.add(p.birthYear))
    return Array.from(seen).sort((a, b) => b - a) // newest first
  }, [allPlayers])

  // --- Filtered + sorted list ---
  const displayed = useMemo(() => {
    return allPlayers
      .filter(p => {
        if (countryFilter !== 'all' && p.playerNationalityCode !== countryFilter) return false
        if (birthYearFilter !== 'all' && p.birthYear !== parseInt(birthYearFilter)) return false
        if (movementThreshold !== -1 && p.rankMovement > -movementThreshold) return false
        return true
      })
      .sort((a, b) => a.rankMovement - b.rankMovement) // most improved first
  }, [allPlayers, countryFilter, birthYearFilter, movementThreshold])

  const movingUp10Count = useMemo(
    () => displayed.filter(p => p.rankMovement <= -10).length,
    [displayed]
  )

  // --- Fetch ---
  async function handleFetch() {
    setFetchStatus('fetching')
    setErrorMsg('')
    setAllPlayers([])
    setAdded(new Set())
    try {
      const res = await fetch(ITF_URL)
      if (!res.ok) throw new Error(`ITF returned HTTP ${res.status}`)
      const data = await res.json()
      const players: ITFPlayer[] = Array.isArray(data) ? data : data.items || data
      if (!Array.isArray(players) || players.length === 0) {
        throw new Error('Unexpected response shape — no player array found')
      }
      setTotalFetched(players.length)
      setAllPlayers(players.filter(p => ALLOWED_NATIONALITIES.has(p.playerNationalityCode)))
      setFetchStatus('fetched')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Fetch failed')
      setFetchStatus('error')
    }
  }

  // --- Individual add ---
  async function handleAdd(player: ITFPlayer) {
    setAdding(prev => new Set(prev).add(player.playerId))
    try {
      const res = await fetch('/api/recruits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${player.playerGivenName} ${player.playerFamilyName}`,
          nationality: player.playerNationalityCode,
          class_year: player.birthYear + 18,
          priority: 'Watch',
          fit_score: 50,
          competing_schools: [],
          notes: `ITF Rank #${player.rank} · Born ${player.birthYear}. Imported from ITF junior rankings.`,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setAdded(prev => new Set(prev).add(player.playerId))
    } finally {
      setAdding(prev => {
        const next = new Set(prev)
        next.delete(player.playerId)
        return next
      })
    }
  }

  const selectClass = 'bg-[#0d1c35] border border-white/10 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors'

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">

      {/* HEADER */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors text-sm">
          ← Dashboard
        </Link>
        <span className="text-white/20">/</span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ITF Junior Rankings Import</h1>
          <p className="text-sm text-slate-400 mt-0.5">Fetch rankings from your browser and add prospects individually</p>
        </div>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto">

        {/* HOW IT WORKS */}
        <div className="bg-blue-950/40 border border-blue-500/20 rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-blue-300 mb-1">How this works</p>
          <p className="text-sm text-slate-400 leading-relaxed">
            The ITF API blocks automated server requests. Clicking <strong className="text-white">Fetch Rankings</strong> pulls the data directly from your browser, filters to target nationalities, and sorts by improvement. Run this weekly — browse the list and click <strong className="text-white">+ Add</strong> on players worth tracking.
          </p>
        </div>

        {/* FETCH BUTTON + ERROR */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleFetch}
            disabled={fetchStatus === 'fetching'}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            {fetchStatus === 'fetching' ? 'Fetching...' : 'Fetch Rankings'}
          </button>
          {fetchStatus === 'fetched' && (
            <span className="text-xs text-slate-500">
              {totalFetched} total · {allPlayers.length} after nationality filter
            </span>
          )}
        </div>

        {fetchStatus === 'error' && (
          <div className="bg-red-950/40 border border-red-500/20 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-red-400">Fetch failed</p>
            <p className="text-sm text-slate-400 mt-0.5">{errorMsg}</p>
          </div>
        )}

        {/* FILTERS + SUMMARY */}
        {fetchStatus === 'fetched' && allPlayers.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <select
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All nationalities</option>
                {countries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={birthYearFilter}
                onChange={e => setBirthYearFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All birth years</option>
                {birthYears.map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>

              <select
                value={movementThreshold}
                onChange={e => setMovementThreshold(parseInt(e.target.value))}
                className={selectClass}
              >
                {MOVEMENT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Showing <span className="text-slate-300 font-medium">{displayed.length}</span> of{' '}
              <span className="text-slate-300 font-medium">{allPlayers.length}</span> players
              {' · '}
              <span className="text-emerald-400 font-medium">{movingUp10Count}</span> moving up 10+ spots
            </p>
          </>
        )}

        {/* PLAYER CARDS */}
        {displayed.length > 0 && (
          <div className="flex flex-col gap-3">
            {displayed.map(p => {
              const isRisingFast = p.rankMovement <= -20
              const isAdded  = added.has(p.playerId)
              const isAdding = adding.has(p.playerId)

              return (
                <div
                  key={p.playerId}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                    isRisingFast
                      ? 'bg-emerald-950/30 border-emerald-500/30'
                      : 'bg-white/3 border-white/5'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                    {p.playerGivenName[0]}{p.playerFamilyName[0]}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-white">
                        {p.playerGivenName} {p.playerFamilyName}
                      </p>
                      {isRisingFast && (
                        <span className="text-xs font-semibold text-emerald-400">↑ Rising Fast</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ITF #{p.rank}
                      {' · '}{p.playerNationalityCode}
                      {' · '}Born {p.birthYear}
                      {' · '}{p.points} pts
                      {' · '}{p.tournamentsPlayed} tournaments
                    </p>
                  </div>

                  {/* Movement badge */}
                  <div className={`text-sm font-semibold tabular-nums flex-shrink-0 w-16 text-right ${
                    p.rankMovement < 0 ? 'text-emerald-400' :
                    p.rankMovement > 0 ? 'text-red-400' :
                    'text-slate-600'
                  }`}>
                    {p.rankMovement === 0
                      ? '—'
                      : p.rankMovement < 0
                      ? `↑ ${Math.abs(p.rankMovement)}`
                      : `↓ ${p.rankMovement}`}
                  </div>

                  {/* Add button */}
                  <button
                    onClick={() => handleAdd(p)}
                    disabled={isAdded || isAdding}
                    className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      isAdded
                        ? 'bg-emerald-900/40 text-emerald-400 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white'
                    }`}
                  >
                    {isAdded ? '✓ Added' : isAdding ? 'Adding...' : '+ Add'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {fetchStatus === 'fetched' && displayed.length === 0 && allPlayers.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-12 text-center">
            <p className="text-sm text-slate-500">No players match the current filters.</p>
            <button
              onClick={() => { setCountryFilter('all'); setBirthYearFilter('all'); setMovementThreshold(-1) }}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Clear all filters
            </button>
          </div>
        )}

      </div>
    </main>
  )
}
