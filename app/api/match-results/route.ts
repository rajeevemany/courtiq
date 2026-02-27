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
// by match rows (<td class="c"> for round, player link, score, win/loss cols)
// ---------------------------------------------------------------------------
function parseTennisRecruitingHTML(html: string): ParsedMatch[] {
  const matches: ParsedMatch[] = []
  let currentTournament = ''

  // Each <tr>…</tr> is a row; process them in order
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1]

    // Tournament header: <th … class="…doublewide…">Name</th>
    const headerMatch = /<th[^>]*class="[^"]*doublewide[^"]*"[^>]*>([\s\S]*?)<\/th>/i.exec(row)
    if (headerMatch) {
      currentTournament = headerMatch[1].replace(/<[^>]+>/g, '').trim()
      continue
    }

    if (!currentTournament) continue

    // Round cell: <td class="c">R1</td>  (short uppercase round codes)
    const roundMatch = /<td[^>]*class="[^"]*\bc\b[^"]*"[^>]*>\s*([A-Z0-9]{1,5})\s*<\/td>/i.exec(row)
    if (!roundMatch) continue

    const round = roundMatch[1].trim()
    const validRounds = new Set(['R1','R2','R3','R4','R5','R64','R32','R16','QF','SF','F','W','RR'])
    if (!validRounds.has(round.toUpperCase())) continue

    // Opponent from player profile anchor: "Name (ranking)" or just "Name"
    const opponentAnchor = /<a[^>]*href="[^"]*(?:player|profile)[^"]*"[^>]*>([^<]+)<\/a>/i.exec(row)
    if (!opponentAnchor) continue

    const opponentText = opponentAnchor[1].trim()
    const nameRankMatch = /^(.+?)\s*\(\d+\)\s*$/.exec(opponentText)
    const opponentName = nameRankMatch ? nameRankMatch[1].trim() : opponentText

    // Score: look for tennis score patterns like "6-4 6-3" or "6-4 6-3(5)"
    const scoreMatch = /\b(\d-\d(?:\(\d+\))?(?:\s+\d-\d(?:\(\d+\))?)+)\b/.exec(row)
    const score = scoreMatch ? scoreMatch[1].trim() : ''

    // W/L: check for non-empty win or loss cell
    const isWin  = /<td[^>]*class="[^"]*(?:\bwin\b)[^"]*"[^>]*>\s*([^<\s][^<]*?)\s*<\/td>/i.test(row)
    const isLoss = /<td[^>]*class="[^"]*(?:\bloss\b)[^"]*"[^>]*>\s*([^<\s][^<]*?)\s*<\/td>/i.test(row)

    if (!isWin && !isLoss) continue

    matches.push({
      tournament_name: currentTournament,
      round: round.toUpperCase(),
      opponent_name: opponentName,
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
// POST /api/match-results  { recruit_id }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log('match-results POST body:', body)
  const { recruit_id } = body

  const { data: recruit, error: rErr } = await supabase
    .from('recruits')
    .select('name, tennisrecruiting_id, itf_player_id, nationality')
    .eq('id', recruit_id)
    .single()

  console.log('recruit lookup result:', JSON.stringify(recruit), 'error:', JSON.stringify(rErr))

  if (rErr || !recruit) {
    return NextResponse.json({ error: 'Recruit not found' }, { status: 404 })
  }

  const allMatches: (ParsedMatch & { recruit_id: string; source: string })[] = []

  // ---- TennisRecruiting ----
  if (recruit.tennisrecruiting_id) {
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
      if (res.ok) {
        const html = await res.text()
        const parsed = parseTennisRecruitingHTML(html)
        parsed.forEach(m => allMatches.push({ ...m, recruit_id, source: 'tennisrecruiting' }))
      }
    } catch (err) {
      console.error('TennisRecruiting fetch error:', err)
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
        parsed.forEach(m => allMatches.push({ ...m, recruit_id, source: 'itf' }))
      }
    } catch (err) {
      console.error('ITF fetch error:', err)
    }
  }

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
