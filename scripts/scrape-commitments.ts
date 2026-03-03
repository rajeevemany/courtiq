/**
 * CourtIQ · Junior DB Scraper
 *
 * Scrapes tennisrecruiting.net with a real Chromium browser (bypasses bot detection),
 * then POSTs parsed players in batches to the CourtIQ API.
 *
 * Usage:
 *   npx tsx scripts/scrape-commitments.ts <startYear> <endYear>
 *
 * Example:
 *   npx tsx scripts/scrape-commitments.ts 2004 2026
 *
 * Prerequisites (run once):
 *   npm install -D playwright tsx
 *   npx playwright install chromium
 *
 * Reads CRON_SECRET from .env.local automatically.
 * Set HEADLESS=true as an env var for unattended runs: HEADLESS=true npx tsx ...
 */

import { chromium } from 'playwright'
import type { Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

// ── Config ────────────────────────────────────────────────────────────────────

const API_URL = 'https://courtiq-three.vercel.app/api/admin/scrape-commitments'
const BATCH_SIZE = 50
const MIN_LIST_DELAY_MS    =  500   // between list page loads
const MAX_LIST_DELAY_MS    = 1500
const MIN_PROFILE_DELAY_MS = 2000   // between player profile fetches
const MAX_PROFILE_DELAY_MS = 4000
const HEADLESS = process.env.HEADLESS === 'true'

// ── Env reader ────────────────────────────────────────────────────────────────

function readEnvLocal(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf-8')
  const vars: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    vars[key] = val
  }
  return vars
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomDelay(min = MIN_LIST_DELAY_MS, max = MAX_LIST_DELAY_MS): Promise<void> {
  const ms = min + Math.floor(Math.random() * (max - min))
  return new Promise(resolve => setTimeout(resolve, ms))
}

function log(msg: string) { console.log(msg) }
function logInline(msg: string) { process.stdout.write(msg) }

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommitmentEntry {
  tennisrecruiting_id: string
  name: string
  state: string | null
  rating: string | null
  committed_school: string | null
  division: string | null
  conference: string | null
}

interface ParsedPlayer extends CommitmentEntry {
  committed_year: number
  ranking_yr1: number | null
  ranking_yr2: number | null
  ranking_yr3: number | null
  ranking_yr4: number | null
  rpi_yr1: number | null
  rpi_yr2: number | null
  rpi_yr3: number | null
  rpi_yr4: number | null
  peak_ranking: number | null
  peak_year: number | null
}

// ── List page scraping ────────────────────────────────────────────────────────

async function scrapeListPage(page: Page, url: string): Promise<CommitmentEntry[]> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Wait up to 12s for player links — gives time if Cloudflare slows load
  const hasPlayers = await page
    .locator('a[href*="/player.asp?id="]')
    .first()
    .isVisible({ timeout: 12_000 })
    .catch(() => false)

  if (!hasPlayers) return []

  // Run extraction inside browser context using real DOM
  const rows = await page.evaluate(() => {
    const results: Array<{
      id: string
      name: string
      rating: string | null
      state: string | null
      school: string | null
      division: string | null
      conference: string | null
    }> = []

    const playerLinks = document.querySelectorAll<HTMLAnchorElement>('a[href*="/player.asp?id="]')

    for (const link of playerLinks) {
      const href = link.href
      const idMatch = href.match(/\/player\.asp\?id=(\d+)/)
      if (!idMatch) continue

      const id = idMatch[1]
      const name = link.textContent?.trim() ?? ''
      if (!name || !id) continue

      const row = link.closest('tr')
      if (!row) continue

      const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() ?? '')

      // Rating: "5-Star", "4-Star" etc.
      const rating = cells.find(c => /\d-Star/i.test(c)) ?? null

      // State: standalone 2-letter uppercase code
      let state: string | null = null
      for (const c of cells) {
        if (/^[A-Z]{2}$/.test(c)) { state = c; break }
      }

      // Division / Conference: "D1 / ACC"
      const divConfText = cells.find(c => /D[123]\s*\//.test(c)) ?? null
      let division: string | null = null
      let conference: string | null = null
      if (divConfText) {
        const parts = divConfText.split('/')
        division = parts[0]?.trim() ?? null
        conference = parts[1]?.trim() ?? null
      }

      // School: longest non-player, non-meta cell
      const firstName = name.split(' ')[0]
      const school = cells.find(c =>
        c.length > 4 &&
        !c.includes(firstName) &&
        !/\d-Star/i.test(c) &&
        !/D[123]\s*\//.test(c) &&
        !/^\d+$/.test(c) &&
        !/^[A-Z]{2}$/.test(c)
      ) ?? null

      results.push({ id, name, rating, state, school, division, conference })
    }

    return results
  })

  return rows.map(r => ({
    tennisrecruiting_id: r.id,
    name: r.name,
    rating: r.rating,
    state: r.state,
    committed_school: r.school,
    division: r.division,
    conference: r.conference,
  }))
}

// ── Cloudflare detection ──────────────────────────────────────────────────────

async function isCloudflareBlocked(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => '')
  if (title.includes('Just a moment')) return true
  const content = await page.content().catch(() => '')
  if (content.includes('cf-browser-verification')) return true
  return false
}

// ── Profile page scraping ─────────────────────────────────────────────────────

interface ProfileData {
  committed_year: number | null
  ranking_yr1: number | null
  ranking_yr2: number | null
  ranking_yr3: number | null
  ranking_yr4: number | null
  rpi_yr1: number | null
  rpi_yr2: number | null
  rpi_yr3: number | null
  rpi_yr4: number | null
  peak_ranking: number | null
  peak_year: number | null
}

function emptyProfile(): ProfileData {
  return {
    committed_year: null,
    ranking_yr1: null, ranking_yr2: null, ranking_yr3: null, ranking_yr4: null,
    rpi_yr1: null,     rpi_yr2: null,     rpi_yr3: null,     rpi_yr4: null,
    peak_ranking: null, peak_year: null,
  }
}

async function scrapeProfile(page: Page, playerId: string): Promise<ProfileData> {
  const url = `https://www.tennisrecruiting.net/player.asp?id=${playerId}`

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // ── Cloudflare check — wait 30s and retry once if blocked ───────────────
    if (await isCloudflareBlocked(page)) {
      log(`\n  ⚠  Cloudflare detected for ${playerId} — waiting 30s then retrying…`)
      await new Promise(resolve => setTimeout(resolve, 30_000))
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      if (await isCloudflareBlocked(page)) {
        log(`  ✗  Still blocked after retry — skipping ${playerId}`)
        return emptyProfile()
      }
    }

    // ── Wait for HIGHEST RANKINGS content (10s timeout) ────────────────────
    const hasRankings = await page
      .locator('text=HIGHEST RANKINGS')
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false)

    if (!hasRankings) {
      // Profile exists but has no rankings section (common for older/incomplete profiles)
      return emptyProfile()
    }

    // ── Extract HIGHEST RANKINGS table using real DOM ──────────────────────
    const byYear = await page.evaluate((): Record<string, { ranking?: number; rpi?: number }> => {
      // Find the td cell that contains "HIGHEST RANKINGS"
      const allTds = Array.from(document.querySelectorAll('td'))
      const hrTd = allTds.find(td => (td.textContent ?? '').includes('HIGHEST RANKINGS'))
      if (!hrTd) return {}

      const tbody = hrTd.closest('tbody')
      if (!tbody) return {}

      const result: Record<string, { ranking?: number; rpi?: number }> = {}
      let lastYear: string | null = null

      for (const row of tbody.querySelectorAll('tr')) {
        const cells = Array.from(row.querySelectorAll('td'))
        if (cells.length < 2) continue

        const label = cells[0].textContent?.trim() ?? ''
        const value = cells[1].textContent?.trim() ?? ''

        // "2024 Recruiting:" row
        const recM = label.match(/^(\d{4})\s+Recruiting:$/)
        if (recM) {
          const yr = recM[1]
          const rank = parseInt(value)
          if (!isNaN(rank)) {
            if (!result[yr]) result[yr] = {}
            result[yr].ranking = rank
            lastYear = yr
          }
          continue
        }

        // "TennisRPI:" row — associated with the year above it
        if (label === 'TennisRPI:' && lastYear !== null) {
          const rpi = parseInt(value)
          if (!isNaN(rpi)) {
            if (!result[lastYear]) result[lastYear] = {}
            result[lastYear].rpi = rpi
          }
          lastYear = null
        }
      }

      return result
    })

    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b)
    if (years.length === 0) return emptyProfile()

    const committedYear = Math.max(...years)
    const out = emptyProfile()
    out.committed_year = committedYear

    years.forEach((yr, idx) => {
      const d = byYear[String(yr)]
      if (idx === 0) { out.ranking_yr1 = d.ranking ?? null; out.rpi_yr1 = d.rpi ?? null }
      else if (idx === 1) { out.ranking_yr2 = d.ranking ?? null; out.rpi_yr2 = d.rpi ?? null }
      else if (idx === 2) { out.ranking_yr3 = d.ranking ?? null; out.rpi_yr3 = d.rpi ?? null }
      else if (idx === 3) { out.ranking_yr4 = d.ranking ?? null; out.rpi_yr4 = d.rpi ?? null }
    })

    // Peak = lowest ranking number (lower number = better rank)
    const ranked = years
      .filter(yr => byYear[String(yr)].ranking !== undefined)
      .map(yr => ({ year: yr, ranking: byYear[String(yr)].ranking as number }))

    if (ranked.length > 0) {
      const peak = ranked.reduce((best, r) => r.ranking < best.ranking ? r : best)
      out.peak_ranking = peak.ranking
      out.peak_year = peak.year
    }

    return out
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Timeout') || msg.includes('timeout')) {
      process.stdout.write(' [timeout]')
    } else {
      process.stdout.write(` [err: ${msg.slice(0, 40)}]`)
    }
    return emptyProfile()
  }
}

// ── Batch upload ──────────────────────────────────────────────────────────────

async function uploadBatch(
  players: ParsedPlayer[],
  secret: string,
): Promise<{ upserted: number; errors: number }> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ players }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = await res.json() as { upserted?: number; errors?: number }
  return { upserted: json.upserted ?? players.length, errors: json.errors ?? 0 }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const [,, arg1, arg2] = process.argv
  if (!arg1 || !arg2) {
    console.error('Usage: npx tsx scripts/scrape-commitments.ts <startYear> <endYear>')
    process.exit(1)
  }

  const startYear = parseInt(arg1)
  const endYear   = parseInt(arg2)

  if (isNaN(startYear) || isNaN(endYear) || startYear > endYear || startYear < 2004 || endYear > 2030) {
    console.error('Years must be integers 2004–2030, startYear ≤ endYear')
    process.exit(1)
  }

  const env = readEnvLocal()
  const cronSecret = env.CRON_SECRET
  if (!cronSecret) {
    console.error('❌  CRON_SECRET not found in .env.local')
    process.exit(1)
  }

  const bar = '═'.repeat(44)
  log(`╔${bar}╗`)
  log(`║  CourtIQ · Junior DB Scraper${' '.repeat(16)}║`)
  log(`║  Years   : ${startYear}–${endYear}${' '.repeat(43 - 10 - String(startYear).length - String(endYear).length)}║`)
  log(`║  Headless: ${HEADLESS}${' '.repeat(43 - 10 - String(HEADLESS).length)}║`)
  log(`║  Batch   : ${BATCH_SIZE} players/upload${' '.repeat(43 - 22 - String(BATCH_SIZE).length)}║`)
  log(`╚${bar}╝`)
  log('')

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-web-security',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  })

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  })

  const page = await ctx.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
  })
  page.setDefaultTimeout(30_000)

  let grandUpserted = 0
  let grandErrors   = 0

  try {
    for (let year = startYear; year <= endYear; year++) {
      const listId = 1049 + (year - 2004) * 10
      log(`\n▶ Year ${year}  (list ID: ${listId})`)
      log('─'.repeat(52))

      // ── Phase 1: collect all player entries from paginated list ──────────
      const entries: CommitmentEntry[] = []
      const seenIds = new Set<string>()

      for (let pageNum = 1; pageNum <= 30; pageNum++) {
        const url = `https://www.tennisrecruiting.net/list.asp?id=${listId}&order=rank&extra=&page=${pageNum}`
        logInline(`  📋 List page ${pageNum}… `)

        const rows = await scrapeListPage(page, url)

        if (rows.length === 0) {
          log('no players — end of list')
          break
        }

        let newCount = 0
        for (const r of rows) {
          if (!seenIds.has(r.tennisrecruiting_id)) {
            seenIds.add(r.tennisrecruiting_id)
            entries.push(r)
            newCount++
          }
        }

        log(`${newCount} new  (${entries.length} total)`)
        if (newCount === 0) break  // full duplicate page → end of list

        if (pageNum < 30) await randomDelay()
      }

      if (entries.length === 0) {
        log(`  ⚠  No players found for ${year} — skipping`)
        continue
      }

      log(`\n  ✓ ${entries.length} unique players — fetching profiles…`)

      // ── Phase 2: scrape each profile + upload in batches ─────────────────
      const batch: ParsedPlayer[] = []
      let yearUpserted = 0
      let yearErrors   = 0

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const pct   = Math.round(((i + 1) / entries.length) * 100)
        const label = `${entry.name}`.slice(0, 28).padEnd(28)
        logInline(`  [${String(i + 1).padStart(3)}/${entries.length}] ${pct.toString().padStart(3)}%  ${label}  `)

        await randomDelay(MIN_PROFILE_DELAY_MS, MAX_PROFILE_DELAY_MS)
        const profile = await scrapeProfile(page, entry.tennisrecruiting_id)

        const rankStr = profile.ranking_yr1 != null ? `#${profile.ranking_yr1}` : '—    '
        const numYrs  = [profile.ranking_yr1, profile.ranking_yr2, profile.ranking_yr3, profile.ranking_yr4]
          .filter(r => r != null).length
        log(`yr1=${rankStr.padEnd(5)}  peak=${profile.peak_ranking ?? '—'}  (${numYrs} ranking yrs)`)

        batch.push({
          ...entry,
          committed_year: profile.committed_year ?? year,
          ranking_yr1:   profile.ranking_yr1,
          ranking_yr2:   profile.ranking_yr2,
          ranking_yr3:   profile.ranking_yr3,
          ranking_yr4:   profile.ranking_yr4,
          rpi_yr1:       profile.rpi_yr1,
          rpi_yr2:       profile.rpi_yr2,
          rpi_yr3:       profile.rpi_yr3,
          rpi_yr4:       profile.rpi_yr4,
          peak_ranking:  profile.peak_ranking,
          peak_year:     profile.peak_year,
        })

        // Upload when batch is full or we've reached the last player for this year
        if (batch.length >= BATCH_SIZE || i === entries.length - 1) {
          logInline(`\n  ⬆  Uploading ${batch.length} players… `)
          try {
            const result = await uploadBatch([...batch], cronSecret)
            yearUpserted += result.upserted
            yearErrors   += result.errors
            log(`✓  ${result.upserted} upserted, ${result.errors} errors`)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            log(`✗  FAILED: ${msg}`)
            yearErrors += batch.length
          }
          batch.length = 0
        }
      }

      grandUpserted += yearUpserted
      grandErrors   += yearErrors
      log(`\n  ✅  Year ${year}: ${yearUpserted} upserted, ${yearErrors} errors`)
    }
  } finally {
    await browser.close()
  }

  log('')
  log(`╔${bar}╗`)
  log(`║  COMPLETE${' '.repeat(35)}║`)
  log(`║  Total upserted : ${String(grandUpserted).padEnd(25)}║`)
  log(`║  Total errors   : ${String(grandErrors).padEnd(25)}║`)
  log(`╚${bar}╝`)
  log('')
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err)
  process.exit(1)
})
