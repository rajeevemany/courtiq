import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TR_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------
// GET /api/admin/scrape-commitments — return total junior_profiles count
// ---------------------------------------------------------------------------
export async function GET() {
  const { count } = await supabase
    .from('junior_profiles')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({ total: count ?? 0 })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CommitmentEntry {
  tennisrecruiting_id: string
  name: string
  state?: string
  rating?: string
  committed_school?: string
  division?: string
  conference?: string
}

interface ProfileData {
  committed_year?: number
  ranking_yr1?: number
  ranking_yr2?: number
  ranking_yr3?: number
  ranking_yr4?: number
  rpi_yr1?: number
  rpi_yr2?: number
  rpi_yr3?: number
  rpi_yr4?: number
  peak_ranking?: number
  peak_year?: number
}

// ---------------------------------------------------------------------------
// List page parser
// Extracts player rows from a tennisrecruiting.net commitment list page.
// ---------------------------------------------------------------------------
function parseListPage(html: string): CommitmentEntry[] {
  const players: CommitmentEntry[] = []

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1]

    // Must contain a player profile link
    const playerLink = /<a[^>]*href="[^"]*\/player\.asp\?id=(\d+)"[^>]*>([^<]+)<\/a>/i.exec(row)
    if (!playerLink) continue

    const tennisrecruiting_id = playerLink[1]
    const name = playerLink[2].trim()

    // Extract all td text content
    const cells: string[] = []
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi
    cellRe.lastIndex = 0
    let cellM: RegExpExecArray | null
    while ((cellM = cellRe.exec(row)) !== null) {
      cells.push(cellM[1].replace(/<[^>]+>/g, '').trim())
    }

    // Rating: "5-Star", "4-Star" etc
    const ratingCell = cells.find(c => /\d-Star/i.test(c))

    // State: 2-letter uppercase code appearing on its own
    const stateMatch = row.match(/\b([A-Z]{2})\b/)
    const state = stateMatch ? stateMatch[1] : undefined

    // Div/Conf: cell containing "D1", "D2", "D3" with a slash
    const divConfCell = cells.find(c => /D[123]\s*\//.test(c))
    let division: string | undefined
    let conference: string | undefined
    if (divConfCell) {
      const parts = divConfCell.split('/')
      division = parts[0]?.trim()
      conference = parts[1]?.trim()
    }

    // School: likely the longest text cell that isn't div/conf or the player name
    const schoolCell = cells.find(c =>
      c.length > 4 &&
      !c.includes(name.split(' ')[0]) &&
      !/\d-Star/i.test(c) &&
      !/D[123]\s*\//.test(c) &&
      !/^\d+$/.test(c) &&
      !/^[A-Z]{2}$/.test(c)
    )

    players.push({
      tennisrecruiting_id,
      name,
      rating: ratingCell,
      state,
      committed_school: schoolCell,
      division,
      conference,
    })
  }

  return players
}

// ---------------------------------------------------------------------------
// Profile page parser
// Extracts HIGHEST RANKINGS data from a player profile page.
// ---------------------------------------------------------------------------
function parseProfile(html: string): ProfileData {
  const hrIdx = html.indexOf('HIGHEST RANKINGS')
  if (hrIdx === -1) return {}

  // Find the enclosing tbody
  const tbodyStart = html.lastIndexOf('<tbody', hrIdx)
  const tbodyEnd = html.indexOf('</tbody>', hrIdx)
  if (tbodyStart === -1 || tbodyEnd === -1) return {}

  const section = html.substring(tbodyStart, tbodyEnd + 8)

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowM: RegExpExecArray | null

  // year → { ranking, rpi }
  const byYear: Record<number, { ranking?: number; rpi?: number }> = {}
  let lastYear: number | null = null

  while ((rowM = rowRegex.exec(section)) !== null) {
    const row = rowM[1]

    // "2026 Recruiting:" row
    const recruitingM = /<td[^>]*>\s*(\d{4})\s+Recruiting:\s*<\/td>\s*<td[^>]*>\s*(\d+)\s*<\/td>/i.exec(row)
    if (recruitingM) {
      const year = parseInt(recruitingM[1])
      const rank = parseInt(recruitingM[2])
      if (!byYear[year]) byYear[year] = {}
      byYear[year].ranking = rank
      lastYear = year
      continue
    }

    // "TennisRPI:" row — associated with the year just above
    const rpiM = /<td[^>]*>\s*TennisRPI:\s*<\/td>\s*<td[^>]*>\s*(\d+)\s*<\/td>/i.exec(row)
    if (rpiM && lastYear !== null) {
      const rpi = parseInt(rpiM[1])
      if (!byYear[lastYear]) byYear[lastYear] = {}
      byYear[lastYear].rpi = rpi
      lastYear = null
    }
  }

  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b)
  if (years.length === 0) return {}

  const committedYear = Math.max(...years)
  const result: ProfileData = { committed_year: committedYear }

  // Assign yr1–yr4 in chronological order
  years.forEach((year, idx) => {
    const d = byYear[year]
    if (idx === 0) { result.ranking_yr1 = d.ranking; result.rpi_yr1 = d.rpi }
    else if (idx === 1) { result.ranking_yr2 = d.ranking; result.rpi_yr2 = d.rpi }
    else if (idx === 2) { result.ranking_yr3 = d.ranking; result.rpi_yr3 = d.rpi }
    else if (idx === 3) { result.ranking_yr4 = d.ranking; result.rpi_yr4 = d.rpi }
  })

  // Peak = lowest ranking number across all years
  const ranked = years
    .map(y => ({ year: y, ranking: byYear[y].ranking }))
    .filter((r): r is { year: number; ranking: number } => r.ranking !== undefined)

  if (ranked.length > 0) {
    const peak = ranked.reduce((best, r) => r.ranking < best.ranking ? r : best)
    result.peak_ranking = peak.ranking
    result.peak_year = peak.year
  }

  return result
}

// ---------------------------------------------------------------------------
// POST /api/admin/scrape-commitments
// Body: { year, delay_ms?, page? }
// Processes the commitment list for ONE year and upserts to junior_profiles.
// Protected by Authorization: Bearer <CRON_SECRET>.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Auth
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const year: number = body.year
  const delayMs: number = body.delay_ms ?? 800

  if (!year || year < 2004 || year > 2030) {
    return NextResponse.json({ error: 'year must be between 2004 and 2030' }, { status: 400 })
  }

  const listId = 1049 + (year - 2004) * 10
  console.log(`[scrape-commitments] year=${year} listId=${listId} delayMs=${delayMs}`)

  // ── Step 1: paginate commitment list ─────────────────────────────────────
  const allPlayers: CommitmentEntry[] = []
  const seenIds = new Set<string>()

  for (let page = 1; page <= 30; page++) {
    const url = `https://www.tennisrecruiting.net/list.asp?id=${listId}&order=rank&extra=&page=${page}`
    console.log(`[scrape-commitments] fetching list page ${page}: ${url}`)

    try {
      const res = await fetch(url, { headers: TR_HEADERS })
      if (!res.ok) {
        console.log(`[scrape-commitments] list page ${page} returned ${res.status}, stopping`)
        break
      }
      const html = await res.text()
      const players = parseListPage(html)
      console.log(`[scrape-commitments] page ${page}: ${players.length} players found`)

      if (players.length === 0) break

      let newCount = 0
      for (const p of players) {
        if (!seenIds.has(p.tennisrecruiting_id)) {
          seenIds.add(p.tennisrecruiting_id)
          allPlayers.push(p)
          newCount++
        }
      }

      // All players on this page were already seen — end of list
      if (newCount === 0) break

      if (page < 30) await sleep(delayMs)
    } catch (err) {
      console.error(`[scrape-commitments] list page ${page} error:`, err)
      break
    }
  }

  console.log(`[scrape-commitments] total players for ${year}: ${allPlayers.length}`)

  // ── Step 2: fetch each player profile ────────────────────────────────────
  let processed = 0
  let errors = 0

  for (const player of allPlayers) {
    await sleep(delayMs)

    try {
      const profileUrl = `https://www.tennisrecruiting.net/player.asp?id=${player.tennisrecruiting_id}`
      const profileRes = await fetch(profileUrl, { headers: TR_HEADERS })

      let profileData: ProfileData = {}
      if (profileRes.ok) {
        const profileHtml = await profileRes.text()
        profileData = parseProfile(profileHtml)
      } else {
        console.warn(`[scrape-commitments] profile ${player.tennisrecruiting_id} returned ${profileRes.status}`)
      }

      const row = {
        tennisrecruiting_id: player.tennisrecruiting_id,
        name: player.name,
        state: player.state ?? null,
        rating: player.rating ?? null,
        committed_school: player.committed_school ?? null,
        division: player.division ?? null,
        conference: player.conference ?? null,
        committed_year: profileData.committed_year ?? year,
        ranking_yr1: profileData.ranking_yr1 ?? null,
        ranking_yr2: profileData.ranking_yr2 ?? null,
        ranking_yr3: profileData.ranking_yr3 ?? null,
        ranking_yr4: profileData.ranking_yr4 ?? null,
        rpi_yr1: profileData.rpi_yr1 ?? null,
        rpi_yr2: profileData.rpi_yr2 ?? null,
        rpi_yr3: profileData.rpi_yr3 ?? null,
        rpi_yr4: profileData.rpi_yr4 ?? null,
        peak_ranking: profileData.peak_ranking ?? null,
        peak_year: profileData.peak_year ?? null,
        data_scraped_at: new Date().toISOString(),
      }

      const { error: upsertErr } = await supabase
        .from('junior_profiles')
        .upsert(row, { onConflict: 'tennisrecruiting_id' })

      if (upsertErr) {
        console.error(`[scrape-commitments] upsert error for ${player.tennisrecruiting_id}:`, upsertErr.message)
        errors++
      } else {
        processed++
      }
    } catch (err) {
      console.error(`[scrape-commitments] error processing ${player.tennisrecruiting_id}:`, err)
      errors++
    }
  }

  console.log(`[scrape-commitments] year=${year} done: processed=${processed} errors=${errors}`)

  return NextResponse.json({ year, processed, errors, total_found: allPlayers.length })
}
