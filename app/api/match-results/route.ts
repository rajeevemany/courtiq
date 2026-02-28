import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ParsedMatch {
  tournament_name: string
  tournament_grade?: string
  surface?: string
  round: string
  opponent_name: string
  opponent_ranking?: number
  opponent_nationality?: string
  opponent_itf_id?: string | null
  score?: string
  result: 'W' | 'L'
  match_date?: string | null
}

// ---------------------------------------------------------------------------
// TennisRecruiting HTML parser
// Activity page: tennisrecruiting.net/player/activity.asp?id=...
// Table structure: tournament header rows (<th class="doublewide">) followed
// by 4-column match rows:
//   col 0: <td class="c">ROUND</td>
//   col 1: win column  — contains player <a> if this match was a Win, else &nbsp;
//   col 2: loss column — contains player <a> if this match was a Loss, else &nbsp;
//   col 3: <td nowrap="">SCORE</td>
// Opponent anchor text format: "Name (ranking)"
// ---------------------------------------------------------------------------
function parseTennisRecruitingHTML(html: string): ParsedMatch[] {
  const matches: ParsedMatch[] = []
  let currentTournament = ''

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1]

    // Tournament header: <th class="doublewide">Name</th>
    const headerMatch = /<th[^>]*class="[^"]*doublewide[^"]*"[^>]*>([\s\S]*?)<\/th>/i.exec(row)
    if (headerMatch) {
      currentTournament = headerMatch[1].replace(/<[^>]+>/g, '').trim()
      continue
    }

    if (!currentTournament) continue

    // Must have a round cell as col 0
    const roundMatch = /<td[^>]*class="[^"]*\bc\b[^"]*"[^>]*>\s*([A-Z0-9]{1,5})\s*<\/td>/i.exec(row)
    if (!roundMatch) continue

    const round = roundMatch[1].trim().toUpperCase()
    const validRounds = new Set(['R1','R2','R3','R4','R5','R64','R32','R16','QF','SF','F','W','RR'])
    if (!validRounds.has(round)) continue

    // Extract all <td> cells from this row
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    cellRegex.lastIndex = 0
    const cells: string[] = []
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1])
    }

    if (cells.length < 4) continue

    // col 1 = win column, col 2 = loss column
    const playerAnchorRe = /<a[^>]*href="[^"]*player[^"]*"[^>]*>([^<]+)<\/a>/i
    const winAnchor  = playerAnchorRe.exec(cells[1])
    const lossAnchor = playerAnchorRe.exec(cells[2])

    if (!winAnchor && !lossAnchor) continue

    const isWin = !!winAnchor
    const anchorText = (winAnchor ?? lossAnchor)![1].trim()

    // "Name (ranking)" → split into name and ranking number
    const nameRankMatch = /^(.+?)\s*\((\d+)\)\s*$/.exec(anchorText)
    const opponentName    = nameRankMatch ? nameRankMatch[1].trim() : anchorText
    const opponentRanking = nameRankMatch ? parseInt(nameRankMatch[2], 10) : undefined

    // Score is in col 3; strip any residual tags
    const score = cells[3].replace(/<[^>]+>/g, '').trim()

    matches.push({
      tournament_name: currentTournament,
      round,
      opponent_name: opponentName,
      opponent_ranking: opponentRanking,
      score,
      result: isWin ? 'W' : 'L',
    })
  }

  return matches
}

// ---------------------------------------------------------------------------
// ITF HTML parser
// Activity page: itftennis.com/en/players/{slug}/{id}/{nat}/jt/s/activity
// NOTE: ITF is Incapsula-protected. Server-side fetches may fail; the route
// is implemented as requested and includes browser-like headers.
// ---------------------------------------------------------------------------
function parseITFHTML(html: string): ParsedMatch[] {
  const matches: ParsedMatch[] = []

  // Helper: extract all matches of a pattern into an array of cleaned strings
  function extractAll(re: RegExp): string[] {
    const results: string[] = []
    const global = new RegExp(re.source, 'gi')
    let m: RegExpExecArray | null
    while ((m = global.exec(html)) !== null) {
      results.push(m[1].replace(/<[^>]+>/g, '').trim())
    }
    return results
  }

  const rounds      = extractAll(/<[^>]*class="[^"]*pprofile-activity-widget__round-label--non-mobile[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/)
  const winLosses   = extractAll(/<[^>]*class="[^"]*pprofile-activity-widget__win-loss[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/)
  const grades      = extractAll(/<[^>]*class="[^"]*pprofile-activity-widget__tournament-type[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/)
  const surfaces    = extractAll(/<[^>]*class="[^"]*pprofile-activity-widget__surface[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/)
  const lastNames   = extractAll(/<[^>]*class="[^"]*pprofile-activity-widget__last-name[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/)
  const firstNames  = extractAll(/<[^>]*class="[^"]*pprofile-activity-widget__first-name[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/)
  const scores      = extractAll(/<[^>]*class="[^"]*pprofile-activity-widget__score[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/)

  // Tournament titles repeat per-match section; collect in order
  const titles      = extractAll(/<[^>]*class="[^"]*pprofile-activity-tournament__title[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/)

  // Opponent nationalities from flag spans: <span class="itf-flags …" title="USA">
  const natRegex = /<[^>]*class="[^"]*itf-flags[^"]*"[^>]*\s+title="([^"]+)"/gi
  const nationalities: string[] = []
  let nm: RegExpExecArray | null
  while ((nm = natRegex.exec(html)) !== null) nationalities.push(nm[1].trim())

  // Opponent ITF IDs from h2h links: …?player2Id=XXXXXXXX&…
  const p2Regex = /[?&]player2Id=([^&"'\s]+)/gi
  const player2Ids: string[] = []
  let pm: RegExpExecArray | null
  while ((pm = p2Regex.exec(html)) !== null) player2Ids.push(pm[1].trim())

  const count = rounds.length
  for (let i = 0; i < count; i++) {
    const wl = winLosses[i]?.toUpperCase().trim()
    if (wl !== 'W' && wl !== 'L') continue

    const opponentName = [firstNames[i], lastNames[i]].filter(Boolean).join(' ').trim()
    if (!opponentName) continue

    matches.push({
      tournament_name: titles[i] || 'Unknown Tournament',
      tournament_grade: grades[i] || undefined,
      surface: surfaces[i] || undefined,
      round: rounds[i] || '',
      result: wl as 'W' | 'L',
      opponent_name: opponentName,
      opponent_nationality: nationalities[i] || undefined,
      opponent_itf_id: player2Ids[i] || null,
      score: scores[i] || '',
    })
  }

  return matches
}

// ---------------------------------------------------------------------------
// GET /api/match-results?recruit_id={id}
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const recruitId = req.nextUrl.searchParams.get('recruit_id')
  if (!recruitId) {
    return NextResponse.json({ error: 'recruit_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('match_results')
    .select('*')
    .eq('recruit_id', recruitId)
    .order('match_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

// ---------------------------------------------------------------------------
// POST /api/match-results
// Supports two modes:
//   1. { recruit_id } — server-fetches TR and ITF pages
//   2. { tennisrecruiting_id, raw_html } — uses HTML from chrome extension
//      (recruit_id may be omitted; looked up via tennisrecruiting_id)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log('match-results POST body keys:', Object.keys(body))

  const { recruit_id, tennisrecruiting_id, raw_html } = body

  // ── Chrome-extension path: raw HTML provided, no server fetch needed ──────
  if (raw_html) {
    let resolvedRecruitId: string = recruit_id

    if (!resolvedRecruitId && tennisrecruiting_id) {
      const { data: found, error: findErr } = await supabase
        .from('recruits')
        .select('id')
        .eq('tennisrecruiting_id', String(tennisrecruiting_id))
        .single()

      if (findErr || !found) {
        return NextResponse.json(
          { error: 'No recruit found with this tennisrecruiting_id' },
          { status: 404 }
        )
      }
      resolvedRecruitId = found.id
    }

    if (!resolvedRecruitId) {
      return NextResponse.json(
        { error: 'recruit_id or tennisrecruiting_id required' },
        { status: 400 }
      )
    }

    console.log('HTML length:', raw_html.length)

    // Look for key markers
    console.log('Has doublewide:', raw_html.includes('doublewide'))
    console.log('Has class="c":', raw_html.includes('class="c"'))
    console.log('Has win class:', raw_html.includes('class="win"'))
    console.log('Has loss class:', raw_html.includes('class="loss"'))

    // Find the activity table section
    const activityIndex = raw_html.indexOf('doublewide')
    if (activityIndex > -1) {
      console.log('Activity section preview:', raw_html.substring(activityIndex - 100, activityIndex + 500))
    }

    const parsed = parseTennisRecruitingHTML(raw_html)
    console.log('Parsed TR matches from raw_html:', parsed.length)
    console.log('Parsed matches:', JSON.stringify(parsed, null, 2))

    if (parsed.length === 0) {
      return NextResponse.json({ success: true, fetched: 0 })
    }

    const toUpsert = parsed.map(m => ({
      ...m,
      recruit_id: resolvedRecruitId,
      source: 'tennisrecruiting',
    }))

    const { error: upsertErr } = await supabase
      .from('match_results')
      .upsert(toUpsert, {
        onConflict: 'recruit_id,tournament_name,round,opponent_name',
        ignoreDuplicates: true,
      })

    if (upsertErr) {
      console.error('Upsert error:', upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, fetched: toUpsert.length })
  }

  // ── Server-fetch path: look up recruit and scrape TR + ITF ───────────────
  if (!recruit_id) {
    return NextResponse.json({ error: 'recruit_id required' }, { status: 400 })
  }

  const { data: recruit, error: rErr } = await supabase
    .from('recruits')
    .select('name, tennisrecruiting_id, itf_player_id, nationality')
    .eq('id', recruit_id)
    .single()

  console.log('recruit lookup result:', JSON.stringify(recruit), 'error:', JSON.stringify(rErr))

  if (rErr || !recruit) {
    return NextResponse.json({ error: 'Recruit not found' }, { status: 404 })
  }

  const trMatches: (ParsedMatch & { recruit_id: string; source: string })[] = []
  const itfMatches: (ParsedMatch & { recruit_id: string; source: string })[] = []

  // ---- TennisRecruiting ----
  if (recruit.tennisrecruiting_id) {
    console.log('Fetching TR activity page for ID:', recruit.tennisrecruiting_id)
    try {
      const url = `https://www.tennisrecruiting.net/player/activity.asp?id=${recruit.tennisrecruiting_id}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.tennisrecruiting.net/',
        },
      })
      console.log('TR activity response status:', res.status)
      const text = await res.text()
      console.log('TR activity response preview:', text.substring(0, 500))
      if (res.ok) {
        const parsed = parseTennisRecruitingHTML(text)
        parsed.forEach(m => trMatches.push({ ...m, recruit_id, source: 'tennisrecruiting' }))
      }
    } catch (err) {
      console.log('TR activity fetch error:', err)
    }
  }

  // ---- ITF ----
  if (recruit.itf_player_id) {
    try {
      const slug = (recruit.name as string)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
      const nationality = ((recruit.nationality as string) || 'usa').toLowerCase().slice(0, 3)
      const url = `https://www.itftennis.com/en/players/${slug}/${recruit.itf_player_id}/${nationality}/jt/s/activity`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.itftennis.com/en/players/',
        },
      })
      if (res.ok) {
        const html = await res.text()
        const parsed = parseITFHTML(html)
        parsed.forEach(m => itfMatches.push({ ...m, recruit_id, source: 'itf' }))
      }
    } catch (err) {
      console.error('ITF fetch error:', err)
    }
  }

  const allMatches = [...trMatches, ...itfMatches]

  console.log('Returning result - TR matches:', trMatches.length, 'ITF matches:', itfMatches.length)

  if (allMatches.length === 0) {
    return NextResponse.json({ success: true, fetched: 0 })
  }

  const { error: upsertErr } = await supabase
    .from('match_results')
    .upsert(allMatches, {
      onConflict: 'recruit_id,tournament_name,round,opponent_name',
      ignoreDuplicates: true,
    })

  if (upsertErr) {
    console.error('Upsert error:', upsertErr)
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, fetched: allMatches.length })
}
