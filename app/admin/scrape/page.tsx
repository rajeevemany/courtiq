'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

export default function AdminScrapePage() {
  const [count, setCount]           = useState<number | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchCount = useCallback(async () => {
    setRefreshing(true)
    try {
      const res  = await fetch('/api/admin/scrape-commitments')
      const data = await res.json()
      setCount(data.total)
      setLastRefresh(new Date())
    } catch {
      // ignore
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 10_000)
    return () => clearInterval(interval)
  }, [fetchCount])

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">

      {/* HEADER */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors text-sm">
          ← Dashboard
        </Link>
        <span className="text-white/20">/</span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Junior DB</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Historical commitment database — built by local Playwright scraper
          </p>
        </div>
      </div>

      <div className="px-8 py-8 max-w-2xl mx-auto flex flex-col gap-6">

        {/* LIVE COUNT */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Records in junior_profiles
          </p>
          <div className="text-6xl font-bold tabular-nums tracking-tight text-white">
            {count === null ? '…' : count.toLocaleString()}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            {refreshing && (
              <span className="w-3 h-3 border border-blue-400/40 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
            )}
            {lastRefresh
              ? `Last refreshed ${lastRefresh.toLocaleTimeString()}`
              : 'Loading…'}
            <button
              onClick={fetchCount}
              disabled={refreshing}
              className="ml-2 text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors underline"
            >
              Refresh now
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-1.5">Auto-refreshes every 10 seconds while page is open</p>
        </div>

        {/* HOW TO RUN */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
            How to Scrape
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-5">
            Scraping runs <strong className="text-white">locally on your machine</strong> using a real
            Chromium browser (via Playwright) to bypass bot detection on tennisrecruiting.net.
            Results are uploaded directly to the production API in batches of 50.
          </p>

          <div className="flex flex-col gap-4">

            {/* Step 1 */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Step 1 — Install dependencies (once)
              </p>
              <div className="bg-black/50 border border-white/5 rounded-lg px-4 py-3 font-mono text-sm text-emerald-400 space-y-1">
                <div>npm install -D playwright tsx</div>
                <div>npx playwright install chromium</div>
              </div>
            </div>

            {/* Step 2 */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Step 2 — Run the scraper
              </p>
              <div className="bg-black/50 border border-white/5 rounded-lg px-4 py-3 font-mono text-sm text-emerald-400">
                npx tsx scripts/scrape-commitments.ts 2004 2026
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Adjust the year range as needed. The script will open a visible browser window so you
                can monitor progress (or solve any Cloudflare challenges manually).
              </p>
            </div>

            {/* Headless mode */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Optional — Headless mode (no window)
              </p>
              <div className="bg-black/50 border border-white/5 rounded-lg px-4 py-3 font-mono text-sm text-slate-400">
                HEADLESS=true npx tsx scripts/scrape-commitments.ts 2004 2026
              </div>
            </div>

          </div>
        </div>

        {/* TIMING + TIPS */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
            What to Expect
          </h2>
          <ul className="text-sm text-slate-400 space-y-2 leading-relaxed">
            <li>
              <span className="text-white font-medium">~50–300 players per year</span> depending on how
              many committed that recruiting class.
            </li>
            <li>
              <span className="text-white font-medium">500–1 500 ms random delay</span> between page
              loads to avoid rate limiting.
            </li>
            <li>
              <span className="text-white font-medium">Full 2004–2026 run takes roughly 2–4 hours.</span>{' '}
              You can stop and restart at any time — data upserts on{' '}
              <code className="text-blue-300">tennisrecruiting_id</code> conflict so nothing is lost.
            </li>
            <li>
              The counter above updates every 10 seconds so you can watch the database grow in real time.
            </li>
          </ul>
        </div>

        {/* TECH INFO */}
        <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-white">List ID formula:</strong>{' '}
            <code className="text-blue-300">listId = 1049 + (year − 2004) × 10</code>.{' '}
            Each profile page is scraped for the <em>HIGHEST RANKINGS</em> table (up to 4 recruiting
            years of ranking + TennisRPI). Peak ranking = lowest number across all years.
            Data is upserted to <code className="text-blue-300">junior_profiles</code> on{' '}
            <code className="text-blue-300">tennisrecruiting_id</code> conflict.
          </p>
        </div>

      </div>
    </main>
  )
}
