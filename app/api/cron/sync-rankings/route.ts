import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TR_LISTS = [
  { id: 1275, classYear: 2027 },
  { id: 1285, classYear: 2028 },
  { id: 1295, classYear: 2029 },
]

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseRankingFromHtml(html: string): number | null {
  const patterns = [
    // Primary: twitter:description meta tag — "Ranked 35th in the nation."
    /<meta[^>]*name=["']twitter:description["'][^>]*content=["'][^"']*Ranked (\d+)(?:st|nd|rd|th) in the nation/i,
    // Secondary: <a href="/list.asp...">35</a> — tennisrecruiting.net ranking link
    /<a\s[^>]*href=["'][^"']*\/list\.asp[^"']*["'][^>]*>\s*(\d+)\s*<\/a>/i,
    // Fallbacks: "National Ranking" label cell followed by value cell
    /National\s+Ranking<\/td>\s*<td[^>]*>\s*#?(\d+)/i,
    /National\s+Ranking[^<]*<\/td>\s*<td[^>]*>\s*#?(\d+)/i,
    // data-attribute or class with "ranking" near a number
    /"ranking"[^>]*>\s*#?(\d+)/i,
    // Loose fallback: "rank" or "ranking" followed by #number within 40 chars
    /rank(?:ing)?[^<]{0,40}#(\d+)/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const num = parseInt(match[1], 10)
      if (num > 0 && num < 10000) return num
    }
  }

  return null
}

async function fetchPlayerPage(tennisrecruitingId: string): Promise<string | null> {
  const url = `https://www.tennisrecruiting.net/player.asp?id=${encodeURIComponent(tennisrecruitingId)}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CourtIQ-Recruiter/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      console.error(`HTTP ${res.status} for tennisrecruiting_id=${tennisrecruitingId}`)
      return null
    }
    return await res.text()
  } catch (err) {
    console.error(`Fetch failed for tennisrecruiting_id=${tennisrecruitingId}:`, err)
    return null
  }
}

async function fetchListPage(listId: number, page: number): Promise<string | null> {
  const url = `https://www.tennisrecruiting.net/list.asp?id=${listId}&page=${page}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CourtIQ-Recruiter/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function parseListPagePlayers(html: string): Array<{
  tennisrecruiting_id: string
  name: string
  national_ranking: number
  location: string | null
}> {
  const players: Array<{
    tennisrecruiting_id: string
    name: string
    national_ranking: number
    location: string | null
  }> = []

  // Extract player links: /player.asp?id=NNNN
  const playerRegex = /<a\s+href=["']\/player\.asp\?id=(\d+)["'][^>]*>([^<]+)<\/a>/gi
  // Extract small rank numbers from table cells
  const rankRegex = /<td[^>]*>\s*(\d{1,3})\s*<\/td>/g

  const rankMatches: number[] = []
  let rankMatch
  while ((rankMatch = rankRegex.exec(html)) !== null) {
    const num = parseInt(rankMatch[1], 10)
    if (num >= 1 && num <= 200) rankMatches.push(num)
  }

  let playerMatch
  let rankIndex = 0
  while ((playerMatch = playerRegex.exec(html)) !== null) {
    const tennisrecruiting_id = playerMatch[1]
    const name = playerMatch[2].trim()
    if (!name || name.length < 2) continue

    const national_ranking = rankMatches[rankIndex] ?? 999
    rankIndex++

    players.push({
      tennisrecruiting_id,
      name,
      national_ranking,
      location: null,
    })
  }

  return players
}

async function runTRBroadScan(): Promise<{ scanned: number }> {
  // Get all tennisrecruiting_ids already in recruits table
  const { data: existingRecruits } = await supabase
    .from('recruits')
    .select('tennisrecruiting_id')
    .not('tennisrecruiting_id', 'is', null)
  const recruitedIds = new Set(existingRecruits?.map(r => r.tennisrecruiting_id) || [])

  // Get existing prospects to calculate rank movement
  const { data: existingProspects } = await supabase
    .from('scouting_prospects')
    .select('tennisrecruiting_id, national_ranking')
    .eq('source', 'tennisrecruiting')
  const prospectRankMap = new Map(existingProspects?.map(p => [p.tennisrecruiting_id, p.national_ranking]) || [])

  const toUpsert: Array<{
    tennisrecruiting_id: string
    name: string
    national_ranking: number
    previous_ranking: number
    rank_movement: number
    is_rising: boolean
    class_year: number
    location: string | null
    nationality: string
    source: string
    last_synced_at: string
  }> = []

  for (const list of TR_LISTS) {
    let seenCount = 0
    for (let page = 1; page <= 10 && seenCount < 200; page++) {
      const html = await fetchListPage(list.id, page)
      if (!html) break
      const players = parseListPagePlayers(html)
      if (players.length < 3) break

      for (const player of players) {
        if (recruitedIds.has(player.tennisrecruiting_id)) continue
        if (player.national_ranking > 200) continue

        const prevRank = prospectRankMap.get(player.tennisrecruiting_id) ?? player.national_ranking
        const movement = player.national_ranking - prevRank
        const is_rising = movement <= -10

        toUpsert.push({
          tennisrecruiting_id: player.tennisrecruiting_id,
          name: player.name,
          national_ranking: player.national_ranking,
          previous_ranking: prevRank,
          rank_movement: movement,
          is_rising,
          class_year: list.classYear,
          location: player.location || null,
          nationality: 'USA',
          source: 'tennisrecruiting',
          last_synced_at: new Date().toISOString(),
        })
        seenCount++
      }

      await sleep(500)
    }
  }

  if (toUpsert.length > 0) {
    console.log('First prospect sample:', JSON.stringify(toUpsert[0]))
    const { error: upsertError } = await supabase
      .from('scouting_prospects')
      .upsert(toUpsert, { onConflict: 'tennisrecruiting_id' })

    if (upsertError) {
      console.error('TR scan upsert error:', JSON.stringify(upsertError))
    } else {
      console.log('TR scan upsert success:', toUpsert.length, 'rows')
    }
  }

  return { scanned: toUpsert.length }
}

export async function GET(request: Request) {
  // Authenticate the cron caller
  const authHeader = request.headers.get('Authorization')
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all recruits with a tennisrecruiting_id
  const { data: recruits, error: fetchError } = await supabase
    .from('recruits')
    .select('id, name, national_ranking, tennisrecruiting_id')
    .not('tennisrecruiting_id', 'is', null)

  if (fetchError) {
    console.error('Failed to fetch recruits:', fetchError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const today = new Date().toISOString().split('T')[0]
  const results = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    details: [] as Array<{
      id: string
      name: string
      status: 'updated' | 'unchanged' | 'failed'
      old_ranking?: number | null
      new_ranking?: number | null
      error?: string
    }>,
  }

  for (const recruit of recruits || []) {
    results.processed++

    const html = await fetchPlayerPage(recruit.tennisrecruiting_id!)

    if (!html) {
      results.failed++
      results.details.push({ id: recruit.id, name: recruit.name, status: 'failed', error: 'Fetch failed' })
      await sleep(500)
      continue
    }

    const scrapedRanking = parseRankingFromHtml(html)

    if (scrapedRanking === null) {
      // Log a snippet to help debug regex patterns if parsing fails
      console.error(`Parse failed for ${recruit.name} (id=${recruit.tennisrecruiting_id})`)
      console.log('HTML total length:', html.length)
      console.log('HTML chars 0-1000:', html.substring(0, 1000))
      console.log('HTML chars 3000-5000:', html.substring(3000, 5000))
      console.log('HTML chars 5000-8000:', html.substring(5000, 8000))
      results.failed++
      results.details.push({ id: recruit.id, name: recruit.name, status: 'failed', error: 'Parse failed' })
      await sleep(500)
      continue
    }

    if (scrapedRanking === recruit.national_ranking) {
      results.unchanged++
      results.details.push({
        id: recruit.id,
        name: recruit.name,
        status: 'unchanged',
        old_ranking: recruit.national_ranking,
        new_ranking: scrapedRanking,
      })
      await sleep(500)
      continue
    }

    // Insert ranking_history row — ON CONFLICT DO NOTHING prevents duplicate-date errors
    const { error: historyError } = await supabase
      .from('ranking_history')
      .insert({
        recruit_id: recruit.id,
        national_ranking: scrapedRanking,
        recorded_date: today,
        source: 'cron',
      })

    if (historyError && historyError.code !== '23505') {
      // 23505 = unique_violation (same recruit, same date already logged — safe to skip)
      console.error(`ranking_history insert failed for ${recruit.id}:`, historyError)
      results.failed++
      results.details.push({ id: recruit.id, name: recruit.name, status: 'failed', error: historyError.message })
      await sleep(500)
      continue
    }

    // Update recruits.national_ranking
    const { error: updateError } = await supabase
      .from('recruits')
      .update({ national_ranking: scrapedRanking })
      .eq('id', recruit.id)

    if (updateError) {
      console.error(`recruits update failed for ${recruit.id}:`, updateError)
      results.failed++
      results.details.push({ id: recruit.id, name: recruit.name, status: 'failed', error: updateError.message })
      await sleep(500)
      continue
    }

    results.updated++
    results.details.push({
      id: recruit.id,
      name: recruit.name,
      status: 'updated',
      old_ranking: recruit.national_ranking,
      new_ranking: scrapedRanking,
    })

    await sleep(500)
  }

  const scanResults = await runTRBroadScan()

  return NextResponse.json({
    success: true,
    run_at: new Date().toISOString(),
    summary: {
      processed: results.processed,
      updated: results.updated,
      unchanged: results.unchanged,
      failed: results.failed,
    },
    details: results.details,
    scan: scanResults,
  })
}
