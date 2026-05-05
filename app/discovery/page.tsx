'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TRMover {
  tennisrecruiting_id: string
  name: string
  ranking: number
  state: string | null
  grad_year: number | null
  rank_change: number
  previous_rank: number
  committed_school: string | null
  rating: string | null
}

interface ITFPlayer {
  itf_player_id: string
  name: string
  nationality: string
  ranking: number
  rank_movement: number
  birth_year: number | null
}

interface DomesticPlayer {
  id: string
  player_name: string
  nationality: string
  domestic_rank: number
  country_code: string
  itf_player_id: string | null
  itf_ranking: number | null
  birth_year: number | null
}

function getDomesticSearchUrl(playerName: string, countryCode: string): string {
  const q = encodeURIComponent(playerName)
  switch (countryCode) {
    case 'DEU': return `https://www.tennis.de/spielen/spielersuche/?q=${q}`
    case 'ESP': return `https://resultadostenis.isquad.es/1/jugadores/buscar?q=${q}`
    case 'FRA': return `https://www.fft.fr/recherche?query=${q}`
    case 'ITA': return `https://www.fitp.it/ricerca?q=${q}`
    case 'GBR': return `https://www.lta.org.uk/fan-zone/british-tennis-players/search/?q=${q}`
    default: return `https://www.google.com/search?q=${encodeURIComponent(playerName + ' tennis ' + countryCode.toLowerCase())}`
  }
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  icon,
  count,
  accentColor,
  viewAllHref,
}: {
  title: string
  icon: string
  count: number
  accentColor: 'amber' | 'blue' | 'teal'
  viewAllHref: string
}) {
  const borderColor = {
    amber: 'border-l-amber-400',
    blue: 'border-l-blue-400',
    teal: 'border-l-teal-400',
  }[accentColor]

  return (
    <div className={`border-l-2 pl-4 ${borderColor} flex items-center justify-between mb-4`}>
      <h2 className="font-semibold text-white flex items-center gap-2">
        <span>{icon}</span>
        {title}
        <span className="text-xs font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </h2>
      <Link href={viewAllHref} className="text-xs text-slate-500 hover:text-white transition-colors">
        View all →
      </Link>
    </div>
  )
}

function EmptyState({ message, linkHref, linkLabel }: { message: string; linkHref: string; linkLabel: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-slate-500">{message}</p>
      <Link href={linkHref} className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block transition-colors">
        {linkLabel} →
      </Link>
    </div>
  )
}

// ── TR Scout Card ─────────────────────────────────────────────────────────────

function TRCard({ player }: { player: TRMover }) {
  const rankColor =
    player.ranking <= 10
      ? 'text-yellow-300'
      : player.ranking <= 30
      ? 'text-yellow-400'
      : 'text-slate-300'

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`https://www.tennisrecruiting.net/player.asp?id=${player.tennisrecruiting_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm hover:underline hover:text-white transition-colors"
          >
            {player.name}
          </a>
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
            ↑ +{player.rank_change}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={`font-mono font-semibold text-sm ${rankColor}`}>#{player.ranking}</span>
          <span className="text-xs text-slate-500">was #{player.previous_rank}</span>
          {player.state && (
            <span className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{player.state}</span>
          )}
          {player.grad_year && (
            <span className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{player.grad_year}</span>
          )}
          {!player.committed_school && (
            <span className="text-xs text-green-400 font-medium">Uncommitted</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ITF Card ──────────────────────────────────────────────────────────────────

function ITFCard({ player }: { player: ITFPlayer }) {
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle')

  async function addToPipeline() {
    setStatus('adding')
    try {
      const res = await fetch('/api/recruits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: player.name,
          nationality: player.nationality,
          class_year: player.birth_year ? player.birth_year + 18 : null,
          priority: 'Watch',
          fit_score: 50,
          competing_schools: [],
          notes: `ITF Rank #${player.ranking}${player.birth_year ? ` · Born ${player.birth_year}` : ''}. Imported from ITF junior rankings.`,
        }),
      })
      setStatus(res.ok ? 'added' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
      <div className="flex-1 min-w-0">
        <a
          href={`https://www.itftennis.com/en/players/${player.name.toLowerCase().replace(/\s+/g, '-')}/${player.itf_player_id}/${player.nationality.toLowerCase()}/junior/rankings-results/`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sm hover:underline hover:text-white transition-colors"
        >
          {player.name}
        </a>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-mono font-semibold text-sm text-blue-400">ITF #{player.ranking}</span>
          <span className="text-xs text-slate-400">{player.nationality}</span>
          {player.birth_year && (
            <span className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">b. {player.birth_year}</span>
          )}
          {player.rank_movement < 0 && (
            <span className="text-xs font-semibold text-green-400">↑ +{Math.abs(player.rank_movement)}</span>
          )}
        </div>
      </div>
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
        {status === 'added' ? '✓ Added' : status === 'adding' ? 'Adding…' : status === 'error' ? 'Error' : '+ Pipeline'}
      </button>
    </div>
  )
}

// ── Domestic Card ─────────────────────────────────────────────────────────────

const COUNTRY_FLAG: Record<string, string> = {
  DEU: '🇩🇪', GBR: '🇬🇧', FRA: '🇫🇷', ESP: '🇪🇸', ITA: '🇮🇹',
  SWE: '🇸🇪', NED: '🇳🇱', AUT: '🇦🇹', NOR: '🇳🇴', SUI: '🇨🇭',
}

function DomesticCard({ player }: { player: DomesticPlayer }) {
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle')

  async function addToPipeline() {
    setStatus('adding')
    try {
      const res = await fetch('/api/recruits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: player.player_name,
          nationality: player.country_code,
          class_year: player.birth_year ? player.birth_year + 18 : null,
          priority: 'Watch',
          fit_score: 50,
          competing_schools: [],
          notes: `Domestic Rank #${player.domestic_rank}${player.itf_ranking ? ` · ITF #${player.itf_ranking}` : ''}. Hidden gem from domestic scout.`,
        }),
      })
      setStatus(res.ok ? 'added' : 'error')
    } catch {
      setStatus('error')
    }
  }

  const flag = COUNTRY_FLAG[player.country_code] ?? '🌍'

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
      <div className="flex-1 min-w-0">
        <a
          href={getDomesticSearchUrl(player.player_name, player.country_code)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sm hover:underline hover:text-white transition-colors"
        >
          {player.player_name}
        </a>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span>{flag}</span>
          <span className="font-mono font-semibold text-sm text-teal-400">#{player.domestic_rank}</span>
          <span className="text-xs text-slate-500">{player.nationality}</span>
          {player.itf_ranking ? (
            <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
              ITF #{player.itf_ranking}
            </span>
          ) : (
            <span className="text-xs text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">No ITF</span>
          )}
        </div>
      </div>
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
            : 'bg-white/5 text-slate-300 border-white/10 hover:bg-teal-500/10 hover:text-teal-300 hover:border-teal-500/30 cursor-pointer'
        }`}
      >
        {status === 'added' ? '✓ Added' : status === 'adding' ? 'Adding…' : status === 'error' ? 'Error' : '+ Pipeline'}
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiscoveryPage() {
  const [trRising, setTrRising] = useState<TRMover[]>([])
  const [itfPlayers, setItfPlayers] = useState<ITFPlayer[]>([])
  const [domesticGems, setDomesticGems] = useState<DomesticPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/tr-scout/movements').then(r => r.json()),
      fetch('/api/itf-cache').then(r => r.json()),
      fetch('/api/domestic-scout/hidden-gems').then(r => r.json()),
    ])
      .then(([tr, itf, domestic]) => {
        setTrRising((tr.rising ?? []).slice(0, 5))
        setItfPlayers((itf.data ?? []).slice(0, 8))
        setDomesticGems((domestic.data ?? []).slice(0, 6))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">

      {/* HEADER */}
      <div className="border-b border-white/10 px-8 py-5">
        <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-semibold tracking-tight mt-1">✦ Scouting Intelligence</h1>
        <p className="text-sm text-slate-400 mt-0.5">Rising prospects across all scouting channels</p>
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
            Loading intelligence…
          </div>
        ) : (
          <div className="flex flex-col gap-8">

            {/* SECTION 1 — TR Scout */}
            <div>
              <SectionHeader
                title="TR Scout: Rising & Uncommitted"
                icon="↑"
                count={trRising.length}
                accentColor="amber"
                viewAllHref="/tr-scout"
              />
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {trRising.length === 0 ? (
                  <EmptyState
                    message="No ranking movement data yet."
                    linkHref="/tr-scout"
                    linkLabel="Capture TR rankings first"
                  />
                ) : (
                  trRising.map(p => <TRCard key={p.tennisrecruiting_id} player={p} />)
                )}
              </div>
            </div>

            {/* SECTION 2 — ITF */}
            <div>
              <SectionHeader
                title="ITF: International Prospects"
                icon="◎"
                count={itfPlayers.length}
                accentColor="blue"
                viewAllHref="/itf-import"
              />
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {itfPlayers.length === 0 ? (
                  <EmptyState
                    message="No ITF players cached yet."
                    linkHref="/itf-import"
                    linkLabel="Open ITF Import to fetch rankings"
                  />
                ) : (
                  itfPlayers.map(p => <ITFCard key={p.itf_player_id} player={p} />)
                )}
              </div>
            </div>

            {/* SECTION 3 — Domestic Scout */}
            <div>
              <SectionHeader
                title="Domestic Scout: Hidden Gems"
                icon="◆"
                count={domesticGems.length}
                accentColor="teal"
                viewAllHref="/domestic-scout"
              />
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {domesticGems.length === 0 ? (
                  <EmptyState
                    message="No hidden gems found yet."
                    linkHref="/domestic-scout"
                    linkLabel="Import domestic rankings first"
                  />
                ) : (
                  domesticGems.map(p => <DomesticCard key={p.id} player={p} />)
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  )
}
