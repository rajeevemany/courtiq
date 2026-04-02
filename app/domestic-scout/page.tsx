'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DomesticPlayer {
  id: string
  player_name: string
  first_name: string | null
  last_name: string | null
  nationality: string
  domestic_rank: number
  domestic_points: number | null
  birth_year: number | null
  country_code: string
  source_name: string
  source_url: string | null
  age_category: string | null
  snapshot_date: string
  itf_player_id: string | null
  itf_ranking: number | null
  is_hidden_gem: boolean
  created_at: string
}

interface IngestResult {
  extracted: number
  matched_itf: number
  hidden_gems: number
}

// ── Config ────────────────────────────────────────────────────────────────────

const PDF_SOURCES = [
  {
    label: 'Germany U18 Boys (DTB)',
    country_code: 'DEU',
    source_name: 'DTB Rankings',
    age_category: 'U18',
    url: 'https://www.tennis.de/content/dam/tennis/dtb/wettbewerbe/ranglisten-und-ratings/ranglisten/ranglisten-upload/DTB-Junioren%20U18-Rangliste.pdf',
  },
  {
    label: 'Germany U16 Boys (DTB)',
    country_code: 'DEU',
    source_name: 'DTB Rankings',
    age_category: 'U16',
    url: 'https://www.tennis.de/content/dam/tennis/dtb/wettbewerbe/ranglisten-und-ratings/ranglisten/ranglisten-upload/DTB-Junioren%20U16-Rangliste.pdf',
  },
]

const COUNTRY_FLAG: Record<string, string> = {
  DEU: '🇩🇪',
  GBR: '🇬🇧',
  EUR: '🇪🇺',
  FRA: '🇫🇷',
  ESP: '🇪🇸',
  ITA: '🇮🇹',
  AUT: '🇦🇹',
  SUI: '🇨🇭',
}

const COUNTRY_LABEL: Record<string, string> = {
  DEU: 'Germany',
  GBR: 'UK',
  EUR: 'Tennis Europe',
  FRA: 'France',
  ESP: 'Spain',
  ITA: 'Italy',
  AUT: 'Austria',
  SUI: 'Switzerland',
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DomesticScoutPage() {
  const [hiddenGems, setHiddenGems] = useState<DomesticPlayer[]>([])
  const [allPlayers, setAllPlayers] = useState<DomesticPlayer[]>([])
  const [loadingGems, setLoadingGems] = useState(true)
  const [activeCountry, setActiveCountry] = useState<string>('All')
  const [showAllPlayers, setShowAllPlayers] = useState(false)

  // PDF import state
  const [selectedSource, setSelectedSource] = useState<string>('0')
  const [customUrl, setCustomUrl] = useState('')
  const [customCountry, setCustomCountry] = useState('')
  const [customSourceName, setCustomSourceName] = useState('')
  const [customAgeCategory, setCustomAgeCategory] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<IngestResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/domestic-scout/hidden-gems')
      .then(r => r.json())
      .then(json => {
        if (json.success) setHiddenGems(json.data)
      })
      .finally(() => setLoadingGems(false))
  }, [])

  const isCustom = selectedSource === 'custom'
  const sourceConfig = !isCustom ? PDF_SOURCES[parseInt(selectedSource)] : null

  async function handleImport() {
    setImporting(true)
    setImportResult(null)
    setImportError(null)

    const body = isCustom
      ? {
          pdf_url: customUrl,
          country_code: customCountry,
          source_name: customSourceName,
          age_category: customAgeCategory,
        }
      : {
          pdf_url: sourceConfig!.url,
          country_code: sourceConfig!.country_code,
          source_name: sourceConfig!.source_name,
          age_category: sourceConfig!.age_category,
        }

    try {
      const res = await fetch('/api/domestic-scout/ingest-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Import failed')
      setImportResult(json)
      // Refresh gems after import
      const gemsRes = await fetch('/api/domestic-scout/hidden-gems')
      const gemsJson = await gemsRes.json()
      if (gemsJson.success) setHiddenGems(gemsJson.data)
    } catch (err) {
      setImportError((err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  // Distinct countries from gems
  const gemCountries = Array.from(new Set(hiddenGems.map(p => p.country_code)))

  const filteredGems =
    activeCountry === 'All'
      ? hiddenGems
      : hiddenGems.filter(p => p.country_code === activeCountry)

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Scouting</p>
          <h1 className="text-2xl font-bold tracking-tight">
            🌍 International Scout
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Domestic rankings from national federations — players not visible on ITF
          </p>
        </div>
        <Link
          href="/"
          className="text-slate-400 hover:text-white text-sm border border-white/10 rounded-lg px-4 py-2 hover:bg-white/5 transition"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="px-8 py-8 space-y-10 max-w-7xl mx-auto">

        {/* ── PDF Import Panel ──────────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Import Rankings PDF</h2>
            <p className="text-slate-400 text-sm mt-1">
              Import official national federation PDFs — Claude extracts and cross-references players against ITF
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-widest mb-1.5 block">Source</label>
                  <select
                    value={selectedSource}
                    onChange={e => setSelectedSource(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
                  >
                    {PDF_SOURCES.map((s, i) => (
                      <option key={i} value={String(i)} className="bg-[#0d1f3c]">
                        {s.label}
                      </option>
                    ))}
                    <option value="custom" className="bg-[#0d1f3c]">Custom URL…</option>
                  </select>
                </div>

                {isCustom && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-widest mb-1.5 block">PDF URL</label>
                      <input
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        placeholder="https://…"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-widest mb-1.5 block">Country Code</label>
                      <input
                        value={customCountry}
                        onChange={e => setCustomCountry(e.target.value)}
                        placeholder="DEU"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-widest mb-1.5 block">Source Name</label>
                      <input
                        value={customSourceName}
                        onChange={e => setCustomSourceName(e.target.value)}
                        placeholder="DTB Rankings"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-widest mb-1.5 block">Age Category</label>
                      <input
                        value={customAgeCategory}
                        onChange={e => setCustomAgeCategory(e.target.value)}
                        placeholder="U18"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-white/20"
                      />
                    </div>
                  </div>
                )}

                {!isCustom && sourceConfig && (
                  <p className="text-xs text-slate-500 truncate">
                    {sourceConfig.url}
                  </p>
                )}
              </div>

              <button
                onClick={handleImport}
                disabled={importing}
                className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition whitespace-nowrap"
              >
                {importing ? 'Importing…' : 'Import PDF Rankings'}
              </button>
            </div>

            {importResult && (
              <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
                ✓ Extracted <strong>{importResult.extracted}</strong> players ·{' '}
                <strong>{importResult.matched_itf}</strong> matched ITF ·{' '}
                <strong className="text-yellow-400">{importResult.hidden_gems}</strong> hidden gems found
              </div>
            )}
            {importError && (
              <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                ✗ {importError}
              </div>
            )}
          </div>
        </section>

        {/* ── Hidden Gems ───────────────────────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Hidden Gems ⭐</h2>
              <p className="text-slate-400 text-sm mt-1">
                Top-50 domestic players with no ITF ranking or ITF rank &gt; 200
              </p>
            </div>
            <span className="text-slate-500 text-sm">{filteredGems.length} players</span>
          </div>

          {/* Country filter tabs */}
          {gemCountries.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {['All', ...gemCountries].map(c => (
                <button
                  key={c}
                  onClick={() => setActiveCountry(c)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    activeCountry === c
                      ? 'bg-white/15 text-white border-white/20'
                      : 'text-slate-500 border-white/10 hover:text-slate-300'
                  }`}
                >
                  {c === 'All' ? 'All' : `${COUNTRY_FLAG[c] ?? ''} ${COUNTRY_LABEL[c] ?? c}`}
                </button>
              ))}
            </div>
          )}

          {loadingGems ? (
            <div className="flex items-center gap-3 py-12 justify-center">
              <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading hidden gems…</span>
            </div>
          ) : filteredGems.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-slate-500 text-sm">
              No hidden gems yet. Import a rankings PDF to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredGems.map(p => (
                <div
                  key={p.id}
                  className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-white text-sm leading-tight">{p.player_name}</p>
                    <span className="text-xs bg-yellow-400/15 text-yellow-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                      ⭐ Hidden Gem
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">
                      {COUNTRY_FLAG[p.country_code] ?? ''} #{p.domestic_rank} {COUNTRY_LABEL[p.country_code] ?? p.country_code}
                      {p.age_category ? ` ${p.age_category}` : ''}
                    </span>
                    {p.birth_year && (
                      <span className="text-xs bg-white/5 text-slate-400 px-2 py-0.5 rounded-full">
                        b. {p.birth_year}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {p.itf_ranking == null ? (
                      <span className="text-xs text-red-400 font-medium">No ITF ranking</span>
                    ) : (
                      <span className="text-xs text-yellow-400 font-medium">ITF #{p.itf_ranking}</span>
                    )}
                    <span className="text-slate-600 text-xs">·</span>
                    <span className="text-xs text-slate-500">{p.source_name}</span>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/recruits', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: p.player_name,
                            nationality: p.country_code,
                            class_year: p.birth_year ? String(p.birth_year + 18) : '',
                            status: 'Prospect',
                            priority: 'Low',
                            plays: 'Right',
                          }),
                        })
                        if (res.ok) {
                          alert(`${p.player_name} added to pipeline`)
                        }
                      } catch {
                        alert('Failed to add player')
                      }
                    }}
                    className="mt-1 text-xs text-teal-400 border border-teal-500/30 hover:bg-teal-500/10 rounded-lg px-3 py-1.5 transition self-start"
                  >
                    + Pipeline
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── All Domestic Players (collapsible) ───────────────────────── */}
        <section>
          <button
            onClick={async () => {
              if (!showAllPlayers && allPlayers.length === 0) {
                const res = await fetch('/api/domestic-scout/hidden-gems?all=true')
                const json = await res.json()
                // fallback: re-use hidden gems endpoint; replace with full list endpoint if added later
                if (json.success) setAllPlayers(json.data)
              }
              setShowAllPlayers(v => !v)
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition"
          >
            <span className={`transition-transform ${showAllPlayers ? 'rotate-90' : ''}`}>▶</span>
            All Domestic Players
            {allPlayers.length > 0 && (
              <span className="text-slate-600 ml-1">({allPlayers.length})</span>
            )}
          </button>

          {showAllPlayers && (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[60px_2fr_100px_100px_90px_60px] gap-x-4 px-5 py-2.5 text-xs uppercase tracking-widest text-slate-500 font-medium border-b border-white/10">
                <span>Rank</span>
                <span>Name</span>
                <span>Country</span>
                <span>Age Cat</span>
                <span>ITF Rank</span>
                <span>Gem</span>
              </div>
              {(hiddenGems.length > 0 ? hiddenGems : []).map((p, i) => (
                <div
                  key={p.id}
                  className={`grid grid-cols-[60px_2fr_100px_100px_90px_60px] gap-x-4 px-5 py-3 text-sm items-center ${
                    i !== hiddenGems.length - 1 ? 'border-b border-white/5' : ''
                  } hover:bg-white/5 transition`}
                >
                  <span className="text-slate-400">#{p.domestic_rank}</span>
                  <span className="text-white font-medium">{p.player_name}</span>
                  <span className="text-slate-400">
                    {COUNTRY_FLAG[p.country_code] ?? ''} {COUNTRY_LABEL[p.country_code] ?? p.country_code}
                  </span>
                  <span className="text-slate-500">{p.age_category ?? '—'}</span>
                  <span className={p.itf_ranking ? 'text-yellow-400' : 'text-red-400/70'}>
                    {p.itf_ranking ? `#${p.itf_ranking}` : '—'}
                  </span>
                  <span>{p.is_hidden_gem ? '⭐' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
