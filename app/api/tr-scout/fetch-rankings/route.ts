import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GRAD_YEARS = [2025, 2026, 2027, 2028]

interface TRPlayer {
  tennisrecruiting_id: string
  name: string
  ranking: number
  rating: string | null
  state: string | null
  committed_school: string | null
}

async function scrapeYear(yr: number): Promise<TRPlayer[]> {
  const url = `https://www.tennisrecruiting.net/recruit/search.asp?q=&g=M&yr=${yr}&st=&z=national`
  console.log('[tr-scout] launching browser for yr=', yr)
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch (gotoErr) {
      console.error('[tr-scout] page.goto failed for yr=', yr, ':', gotoErr instanceof Error ? gotoErr.message : String(gotoErr))
      throw gotoErr
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

    const html = await page.content()
    console.log('[tr-scout] page content sample yr=', yr, ':', html.slice(0, 500))

    const plainText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Extract the tennis recruiting rankings list from this page. Return ONLY valid JSON, no markdown fences.

Return this structure:
{
  "players": [
    {
      "name": "First Last",
      "ranking": 1,
      "rating": "5-Star or null",
      "state": "CA or null",
      "committed_school": "School name or null",
      "tennisrecruiting_id": "123456"
    }
  ]
}

Rules:
- tennisrecruiting_id comes from the player profile URL (/player.asp?id=XXXXXX)
- committed_school is null if the player is uncommitted
- Only include players with a valid ranking number
- Extract up to 100 players
- rating is in format '5-Star', '4-Star' etc

Page text:
${plainText}`,
        }],
      }),
    })

    const data = await response.json()
    const raw = data.content[0].text
    const content = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

    try {
      const extracted = JSON.parse(content)
      const players: TRPlayer[] = extracted.players ?? []
      console.log(`[tr-scout] yr=${yr} extracted ${players.length} players`)
      return players
    } catch {
      console.warn(`[tr-scout] yr=${yr} failed to parse Claude response:`, content.slice(0, 200))
      return []
    }
  } finally {
    await browser.close()
  }
}

export async function POST(_req: NextRequest) {
  if (process.env.VERCEL) {
    return NextResponse.json({
      error: 'Server-side fetch unavailable on Vercel. Use the Chrome extension to capture rankings directly from tennisrecruiting.net.',
      use_extension: true,
    }, { status: 503 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]

    // Scrape all four grad years
    const allPlayers: (TRPlayer & { grad_year: number })[] = []
    for (const yr of GRAD_YEARS) {
      const players = await scrapeYear(yr)
      for (const p of players) {
        allPlayers.push({ ...p, grad_year: yr })
      }
    }

    if (allPlayers.length === 0) {
      return NextResponse.json({ error: 'No players scraped — site may have changed structure' }, { status: 500 })
    }

    // Upsert into tr_ranking_snapshots
    const rows = allPlayers.map(p => ({
      tennisrecruiting_id: p.tennisrecruiting_id,
      name: p.name,
      ranking: p.ranking,
      rating: p.rating,
      state: p.state,
      committed_school: p.committed_school,
      snapshot_date: today,
    }))

    const { error: upsertError } = await supabase
      .from('tr_ranking_snapshots')
      .upsert(rows, { onConflict: 'tennisrecruiting_id,snapshot_date' })

    if (upsertError) {
      console.error('[tr-scout] upsert error:', upsertError.message)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Get the previous snapshot date (most recent before today)
    const { data: prevDates } = await supabase
      .from('tr_ranking_snapshots')
      .select('snapshot_date')
      .lt('snapshot_date', today)
      .order('snapshot_date', { ascending: false })
      .limit(1)

    const prevDate = prevDates?.[0]?.snapshot_date ?? null

    let movers: object[] = []
    let entered_top30: object[] = []
    let newly_uncommitted: object[] = []

    if (prevDate) {
      // Fetch today's and previous snapshots
      const { data: todaySnaps } = await supabase
        .from('tr_ranking_snapshots')
        .select('*')
        .eq('snapshot_date', today)

      const { data: prevSnaps } = await supabase
        .from('tr_ranking_snapshots')
        .select('*')
        .eq('snapshot_date', prevDate)

      const prevMap = new Map((prevSnaps ?? []).map(p => [p.tennisrecruiting_id, p]))

      for (const cur of todaySnaps ?? []) {
        const prev = prevMap.get(cur.tennisrecruiting_id)
        if (!prev) continue

        const rankChange = prev.ranking - cur.ranking // positive = improved

        if (rankChange >= 5) {
          movers.push({
            ...cur,
            previous_rank: prev.ranking,
            rank_change: rankChange,
          })
        }

        if (cur.ranking <= 30 && prev.ranking > 30) {
          entered_top30.push({
            ...cur,
            previous_rank: prev.ranking,
            rank_change: rankChange,
          })
        }

        if (!cur.committed_school && prev.committed_school) {
          newly_uncommitted.push({
            ...cur,
            previous_school: prev.committed_school,
          })
        }
      }
    }

    return NextResponse.json({
      snapshots_saved: rows.length,
      movers,
      newly_uncommitted,
      entered_top30,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[tr-scout/fetch-rankings]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
