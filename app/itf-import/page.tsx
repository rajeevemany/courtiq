'use client'

import { useState } from 'react'
import Link from 'next/link'

const ALLOWED_NATIONALITIES = new Set([
  'USA','GBR','AUS','CAN','NZL','IRL','RSA','BAH',
  'SUI','SWE','NOR','DEN','NED','GER','AUT','FIN','BEL',
  'IND','HKG','SGP','HUN','SVK','ESP','FRA','ITA',
])

const ITF_URL = 'https://www.itftennis.com/tennis/api/PlayerRankApi/GetPlayerRankings?circuitCode=JT&playerTypeCode=B&ageCategoryCode=&juniorRankingType=itf&take=500&skip=0&isOrderAscending=true'

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

type Status = 'idle' | 'fetching' | 'fetched' | 'importing' | 'done' | 'error'

export default function ITFImportPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [filtered, setFiltered] = useState<ITFPlayer[]>([])
  const [totalFetched, setTotalFetched] = useState(0)
  const [upsertedCount, setUpsertedCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleFetch() {
    setStatus('fetching')
    setErrorMsg('')
    setFiltered([])
    try {
      const res = await fetch(ITF_URL)
      if (!res.ok) throw new Error(`ITF returned HTTP ${res.status}`)
      const data = await res.json()
      const players: ITFPlayer[] = Array.isArray(data) ? data : data.items || data
      if (!Array.isArray(players) || players.length === 0) {
        throw new Error('Unexpected response shape — no player array found')
      }
      setTotalFetched(players.length)
      setFiltered(players.filter(p => ALLOWED_NATIONALITIES.has(p.playerNationalityCode)))
      setStatus('fetched')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Fetch failed')
      setStatus('error')
    }
  }

  async function handleImport() {
    setStatus('importing')
    try {
      const res = await fetch('/api/cron/sync-itf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: filtered }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Import failed')
      setUpsertedCount(json.upserted)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed')
      setStatus('error')
    }
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
          <h1 className="text-xl font-semibold tracking-tight">ITF Junior Rankings Import</h1>
          <p className="text-sm text-slate-400 mt-0.5">Fetch rankings from your browser and import into CourtIQ</p>
        </div>
      </div>

      <div className="px-8 py-6 max-w-3xl mx-auto">

        {/* HOW IT WORKS */}
        <div className="bg-blue-950/40 border border-blue-500/20 rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-blue-300 mb-1">How this works</p>
          <p className="text-sm text-slate-400 leading-relaxed">
            The ITF API blocks automated server requests. Clicking <strong className="text-white">Fetch Rankings</strong> pulls the data directly from your browser (which passes bot detection), filters to target nationalities, and lets you review before importing. Run this weekly — takes about 30 seconds.
          </p>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleFetch}
            disabled={status === 'fetching' || status === 'importing'}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            {status === 'fetching' ? 'Fetching...' : 'Fetch Rankings'}
          </button>

          {(status === 'fetched' || status === 'error') && filtered.length > 0 && (
            <button
              onClick={handleImport}
              disabled={status === 'importing'}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              Import {filtered.length} Players to CourtIQ
            </button>
          )}

          {status === 'importing' && (
            <span className="text-sm text-slate-400">Importing...</span>
          )}
        </div>

        {/* RESULT BANNERS */}
        {status === 'done' && (
          <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-emerald-400">Import complete</p>
            <p className="text-sm text-slate-400 mt-0.5">
              {upsertedCount} prospects upserted — visible in the{' '}
              <Link href="/discovery" className="text-blue-400 hover:text-blue-300 underline">
                Not In Pipeline
              </Link>{' '}
              tab.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-950/40 border border-red-500/20 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-red-400">Error</p>
            <p className="text-sm text-slate-400 mt-0.5">{errorMsg}</p>
          </div>
        )}

        {/* STATS ROW */}
        {totalFetched > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Total Fetched</p>
              <p className="text-3xl font-semibold">{totalFetched}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">After Filter</p>
              <p className="text-3xl font-semibold text-purple-400">{filtered.length}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Nationalities</p>
              <p className="text-3xl font-semibold text-slate-300">{ALLOWED_NATIONALITIES.size}</p>
            </div>
          </div>
        )}

        {/* PREVIEW TABLE */}
        {filtered.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <p className="text-sm font-semibold">{filtered.length} eligible prospects</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Filtered to {ALLOWED_NATIONALITIES.size} target nationalities · sorted by ITF rank
              </p>
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0d1c35]">
                  <tr className="text-xs text-slate-500 uppercase tracking-wider">
                    <th className="text-left px-6 py-3 font-semibold">Rank</th>
                    <th className="text-left px-6 py-3 font-semibold">Name</th>
                    <th className="text-left px-6 py-3 font-semibold">Nat.</th>
                    <th className="text-left px-6 py-3 font-semibold">Born</th>
                    <th className="text-right px-6 py-3 font-semibold">Movement</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr
                      key={p.playerId}
                      className={`border-t border-white/5 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                    >
                      <td className="px-6 py-3 font-semibold text-slate-300">#{p.rank}</td>
                      <td className="px-6 py-3 text-white">
                        {p.playerGivenName} {p.playerFamilyName}
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 font-medium">
                          {p.playerNationalityCode}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-400">{p.birthYear}</td>
                      <td className={`px-6 py-3 text-right font-medium tabular-nums ${
                        p.rankMovement < 0 ? 'text-emerald-400' :
                        p.rankMovement > 0 ? 'text-red-400' :
                        'text-slate-600'
                      }`}>
                        {p.rankMovement === 0
                          ? '—'
                          : p.rankMovement < 0
                          ? `↑ ${Math.abs(p.rankMovement)}`
                          : `↓ ${p.rankMovement}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
