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
    const activeCell = (winAnchor ? cells[1] : cells[2])
    const anchorText = (winAnchor ?? lossAnchor)![1].trim()

    // Opponent name is the anchor text directly (no ranking inside the tag)
    console.log('Opponent anchor text:', anchorText)
    const opponentName = anchorText

    // Ranking appears after </a> in the cell: <a href="...">Name</a> (68)
    const rankingInCell = /<\/a>[^(]*\((\d+)\)/.exec(activeCell)
    const opponentRanking = rankingInCell ? parseInt(rankingInCell[1], 10) : undefined
    console.log('Opponent ranking from cell:', opponentRanking)

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
// Processes HTML in document order: collects tournament-header events and
// match-result events (by round-label position), sorts by position, then
// emits ParsedMatch entries while tracking the current tournament context.
// ---------------------------------------------------------------------------
function parseITFHTML(html: string): ParsedMatch[] {
  const matches: ParsedMatch[] = []

  interface TournEv {
    pos: number; type: 'tournament'
    name: string; grade?: string; surface?: string
  }
  interface MatchEv {
    pos: number; type: 'match'
    round: string; result: 'W' | 'L'
    firstName: string; lastName: string
    nationality?: string; player2Id?: string | null; score: string
  }
  type Ev = TournEv | MatchEv
  const events: Ev[] = []

  // ── Tournament headers: <h2 class="pprofile-activity-tournament__title"><a>NAME</a></h2> ──
  const h2Re = /<h2[^>]*class="[^"]*pprofile-activity-tournament__title[^"]*"[^>]*>/gi
  let h2m: RegExpExecArray | null
  while ((h2m = h2Re.exec(html)) !== null) {
    const start = h2m.index
    const h2End = html.indexOf('</h2>', start)
    if (h2End === -1) continue
    const h2Block = html.substring(start, h2End + 5)
    const aM = /<a[^>]*>([\s\S]*?)<\/a>/i.exec(h2Block)
    const name = aM ? aM[1].replace(/<[^>]+>/g, '').trim() : ''
    if (!name) continue

    // Grade and surface appear in the tournament block just after the h2
    const nearby = html.substring(h2End, h2End + 800)
    const gradeM  = /<span[^>]*class="[^"]*pprofile-activity-widget__tournament-type[^"]*"[^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/i.exec(nearby)
    const surfM   = /<span[^>]*class="[^"]*pprofile-activity-widget__surface[^"]*"[^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/i.exec(nearby)
    events.push({
      pos: start, type: 'tournament', name,
      grade:   gradeM ? gradeM[1].replace(/<[^>]+>/g, '').trim()  : undefined,
      surface: surfM  ? surfM[1].replace(/<[^>]+>/g, '').trim()   : undefined,
    })
  }

  // ── Match result blocks, keyed by non-mobile round label ─────────────────
  const roundLabelRe = /<strong[^>]*class="[^"]*pprofile-activity-widget__round-label--non-mobile[^"]*"[^>]*>([\s\S]*?)<\/strong>/gi
  let rlm: RegExpExecArray | null
  while ((rlm = roundLabelRe.exec(html)) !== null) {
    const blockStart = rlm.index
    const round = rlm[1].replace(/<[^>]+>/g, '').trim()

    // Slice this match's HTML block: from this round label to the start of the next
    const nextRoundPos = html.indexOf('pprofile-activity-widget__round-label--non-mobile', blockStart + rlm[0].length)
    const blockEnd = nextRoundPos > -1 ? nextRoundPos : blockStart + 3000
    const block = html.substring(blockStart, blockEnd)

    // Win / Loss
    const wlM = /<span[^>]*class="[^"]*pprofile-activity-widget__win-loss[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(block)
    if (!wlM) continue
    const wl = wlM[1].replace(/<[^>]+>/g, '').trim().toUpperCase()
    if (wl !== 'W' && wl !== 'L') continue

    // Opponent names
    const fnM = /<span[^>]*class="[^"]*pprofile-activity-widget__first-name[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(block)
    const lnM = /<span[^>]*class="[^"]*pprofile-activity-widget__last-name[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(block)
    const firstName = fnM ? fnM[1].replace(/<[^>]+>/g, '').trim() : ''
    const lastName  = lnM ? lnM[1].replace(/<[^>]+>/g, '').trim() : ''
    if (!firstName && !lastName) continue

    // Nationality from itf-flags--XXX class name
    const natM = /class="[^"]*itf-flags--([a-z]{3})[^"]*"/i.exec(block)
    const nationality = natM ? natM[1].toUpperCase() : undefined

    // Opponent ITF ID from h2h player2Id URL param
    const p2M = /[?&]player2Id=([^&"'\s]+)/i.exec(block)
    const player2Id = p2M ? p2M[1].trim() : null

    // Score: join all <li class="pprofile-activity-widget__score"> texts
    const scoreLiRe = /<li[^>]*class="[^"]*pprofile-activity-widget__score[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
    const scoreParts: string[] = []
    let slm: RegExpExecArray | null
    while ((slm = scoreLiRe.exec(block)) !== null) {
      const t = slm[1].replace(/<[^>]+>/g, '').trim()
      if (t) scoreParts.push(t)
    }

    events.push({
      pos: blockStart, type: 'match',
      round, result: wl as 'W' | 'L',
      firstName, lastName, nationality, player2Id,
      score: scoreParts.join(' '),
    })
  }

  // ── Assemble in document order ────────────────────────────────────────────
  events.sort((a, b) => a.pos - b.pos)

  let currentTournament = 'Unknown Tournament'
  let currentGrade: string | undefined
  let currentSurface: string | undefined

  for (const ev of events) {
    if (ev.type === 'tournament') {
      currentTournament = ev.name
      currentGrade  = ev.grade
      currentSurface = ev.surface
    } else {
      matches.push({
        tournament_name: currentTournament,
        tournament_grade: currentGrade,
        surface: currentSurface,
        round: ev.round,
        result: ev.result,
        opponent_name: [ev.firstName, ev.lastName].filter(Boolean).join(' '),
        opponent_nationality: ev.nationality,
        opponent_itf_id: ev.player2Id,
        score: ev.score,
      })
    }
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
// Modes:
//   1. { recruit_id } — server-fetches TR and ITF pages
//   2. { tennisrecruiting_id, raw_html } — TR HTML from chrome extension
//   3. { itf_player_id, raw_html, source: 'itf' } — ITF HTML from chrome extension
//      In modes 2 & 3 recruit_id may be omitted; looked up by external ID.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log('match-results POST body keys:', Object.keys(body))

  const { recruit_id, tennisrecruiting_id, itf_player_id, raw_html, source } = body

  // ── Chrome-extension ITF path ─────────────────────────────────────────────
  if (raw_html && source === 'itf') {
    let resolvedRecruitId: string = recruit_id

    if (!resolvedRecruitId && itf_player_id) {
      const { data: found, error: findErr } = await supabase
        .from('recruits')
        .select('id')
        .eq('itf_player_id', String(itf_player_id))
        .single()

      if (findErr || !found) {
        return NextResponse.json(
          { error: 'No recruit found with this itf_player_id' },
          { status: 404 }
        )
      }
      resolvedRecruitId = found.id
    }

    if (!resolvedRecruitId) {
      return NextResponse.json(
        { error: 'recruit_id or itf_player_id required' },
        { status: 400 }
      )
    }

    const parsed = parseITFHTML(raw_html)
    console.log('Parsed ITF matches from raw_html:', parsed.length)

    if (parsed.length === 0) {
      return NextResponse.json({ success: true, fetched: 0 })
    }

    const toUpsert = parsed.map(m => ({
      ...m,
      recruit_id: resolvedRecruitId,
      source: 'itf',
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

  // ── Chrome-extension TR path ──────────────────────────────────────────────
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
    console.log('Has doublewide:', raw_html.includes('doublewide'))
    console.log('Has class="c":', raw_html.includes('class="c"'))

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
