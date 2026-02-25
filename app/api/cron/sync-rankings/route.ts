import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseRankingFromHtml(html: string): number | null {
  const patterns = [
    // Primary: <a href="/list.asp...">35</a> — tennisrecruiting.net ranking link
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
      console.error(`Parse failed for ${recruit.name} (id=${recruit.tennisrecruiting_id}). HTML snippet:`, html.substring(0, 2000))
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
  })
}
