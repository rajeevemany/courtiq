'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface YearResult {
  year: number
  processed: number
  errors: number
  total_found: number
  status: 'running' | 'done' | 'error'
  message?: string
}

export default function AdminScrapePage() {
  const [startYear, setStartYear]   = useState(2020)
  const [endYear, setEndYear]       = useState(2026)
  const [delayMs, setDelayMs]       = useState(800)
  const [running, setRunning]       = useState(false)
  const [log, setLog]               = useState<YearResult[]>([])
  const [totalInDB, setTotalInDB]   = useState<number | null>(null)
  const stopRef = useRef(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchTotal()
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  async function fetchTotal() {
    try {
      const res = await fetch('/api/admin/scrape-commitments')
      const data = await res.json()
      setTotalInDB(data.total)
    } catch {
      // ignore
    }
  }

  function appendLog(result: YearResult) {
    setLog(prev => {
      const idx = prev.findIndex(r => r.year === result.year)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = result
        return next
      }
      return [...prev, result]
    })
  }

  async function handleStart() {
    stopRef.current = false
    setRunning(true)
    setLog([])

    const secret = prompt('Enter CRON_SECRET:')
    if (!secret) {
      setRunning(false)
      return
    }

    for (let year = startYear; year <= endYear; year++) {
      if (stopRef.current) break

      appendLog({ year, processed: 0, errors: 0, total_found: 0, status: 'running' })

      try {
        const res = await fetch('/api/admin/scrape-commitments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`,
          },
          body: JSON.stringify({ year, delay_ms: delayMs }),
        })

        const data = await res.json()

        if (!res.ok) {
          appendLog({ year, processed: 0, errors: 1, total_found: 0, status: 'error', message: data.error })
        } else {
          appendLog({ year, processed: data.processed, errors: data.errors, total_found: data.total_found, status: 'done' })
        }
      } catch (err) {
        appendLog({ year, processed: 0, errors: 1, total_found: 0, status: 'error', message: String(err) })
      }

      await fetchTotal()
    }

    setRunning(false)
    fetchTotal()
  }

  function handleStop() {
    stopRef.current = true
  }

  const totalProcessed = log.reduce((sum, r) => sum + r.processed, 0)
  const totalErrors    = log.reduce((sum, r) => sum + r.errors, 0)

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">

      {/* HEADER */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors text-sm">
          ← Dashboard
        </Link>
        <span className="text-white/20">/</span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Junior DB Scraper</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Build historical commitment database from tennisrecruiting.net
          </p>
        </div>
        <div className="ml-auto">
          <span className="text-xs text-slate-500">Total in DB:</span>{' '}
          <span className="text-sm font-semibold text-white">
            {totalInDB === null ? '…' : totalInDB.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="px-8 py-6 max-w-3xl mx-auto flex flex-col gap-6">

        {/* CONFIG */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Scraper Config
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Start Year
              </label>
              <input
                type="number"
                value={startYear}
                onChange={e => setStartYear(parseInt(e.target.value))}
                disabled={running}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                End Year
              </label>
              <input
                type="number"
                value={endYear}
                onChange={e => setEndYear(parseInt(e.target.value))}
                disabled={running}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Delay (ms)
              </label>
              <input
                type="number"
                value={delayMs}
                onChange={e => setDelayMs(parseInt(e.target.value))}
                disabled={running}
                step={100}
                min={200}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleStart}
              disabled={running}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {running ? 'Scraping…' : '▶ Start Scraping'}
            </button>
            {running && (
              <button
                onClick={handleStop}
                className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                ■ Stop
              </button>
            )}
            {log.length > 0 && !running && (
              <span className="text-xs text-slate-500">
                {totalProcessed.toLocaleString()} processed · {totalErrors} errors
              </span>
            )}
          </div>
        </div>

        {/* PROGRESS LOG */}
        {log.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Progress
            </h2>
            <div className="flex flex-col gap-1.5 max-h-[480px] overflow-y-auto">
              {log.map(r => (
                <div key={r.year} className="flex items-center gap-3 text-sm">
                  {r.status === 'running' && (
                    <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
                  )}
                  {r.status === 'done' && (
                    <span className="text-green-400 flex-shrink-0">✓</span>
                  )}
                  {r.status === 'error' && (
                    <span className="text-red-400 flex-shrink-0">✗</span>
                  )}
                  <span className="text-slate-300 w-12 flex-shrink-0 font-mono">{r.year}</span>
                  {r.status === 'running' && (
                    <span className="text-slate-500">fetching…</span>
                  )}
                  {r.status === 'done' && (
                    <span className="text-slate-400">
                      <span className="text-white font-medium">{r.processed}</span> players processed
                      {r.total_found > r.processed && (
                        <span className="text-slate-600"> ({r.total_found} found)</span>
                      )}
                      {r.errors > 0 && (
                        <span className="text-red-400 ml-2">· {r.errors} errors</span>
                      )}
                    </span>
                  )}
                  {r.status === 'error' && (
                    <span className="text-red-400 text-xs">{r.message ?? 'Failed'}</span>
                  )}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* INFO */}
        <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-white">How it works:</strong> For each year, the scraper fetches the
            TennisRecruiting commitment list (list ID = 1049 + (year − 2004) × 10), then fetches each
            player&apos;s profile page to extract their historical rankings. All data is upserted to the{' '}
            <code className="text-blue-300">junior_profiles</code> table.
            Each year typically takes 2–5 minutes depending on the delay setting and number of players.
          </p>
        </div>

      </div>
    </main>
  )
}
