import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

interface ExtractedPlayer {
  rank: number
  last_name: string
  first_name: string
  nationality: string
  birth_year: number | null
  points: number | null
}

async function crossReferenceAndUpsert(
  players: ExtractedPlayer[],
  country_code: string,
  source_name: string,
  age_category: string,
  source_url: string | null
) {
  const snapshot_date = new Date().toISOString().split('T')[0]
  let matched_itf = 0
  let hidden_gems = 0

  const rows = await Promise.all(
    players.map(async (p) => {
      const player_name = `${p.first_name} ${p.last_name}`.trim()

      const { data: itfMatches } = await supabase
        .from('itf_players_cache')
        .select('itf_player_id, ranking')
        .ilike('name', `%${p.last_name}%`)
        .limit(1)

      const itfMatch = itfMatches?.[0] ?? null
      const itf_player_id = itfMatch?.itf_player_id ?? null
      const itf_ranking: number | null = itfMatch?.ranking ?? null

      if (itfMatch) matched_itf++

      const is_hidden_gem =
        p.rank <= 50 && (itf_ranking === null || itf_ranking > 200)
      if (is_hidden_gem) hidden_gems++

      return {
        player_name,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        nationality: p.nationality || country_code,
        domestic_rank: p.rank,
        domestic_points: p.points ?? null,
        birth_year: p.birth_year ?? null,
        country_code,
        source_name,
        source_url: source_url ?? null,
        age_category,
        snapshot_date,
        itf_player_id,
        itf_ranking,
        is_hidden_gem,
      }
    })
  )

  await supabase
    .from('domestic_rankings')
    .upsert(rows, { onConflict: 'player_name,country_code,age_category,snapshot_date' })

  return { extracted: players.length, matched_itf, hidden_gems }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function POST(request: Request) {
  try {
    const { html, country_code, source_name, age_category, source_url } = await request.json()

    if (!html || !country_code || !source_name || !age_category) {
      return NextResponse.json(
        { error: 'Missing required fields: html, country_code, source_name, age_category' },
        { status: 400 }
      )
    }

    const plainText = stripHtml(html).slice(0, 40000) // cap to avoid token overflow

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Extract junior tennis rankings from this page content.
Return ONLY valid JSON array:
[{ "rank": number, "last_name": string, "first_name": string, "nationality": string, "birth_year": number or null, "points": number or null }]

Page content:
${plainText}`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Claude did not return a JSON array')

    const players: ExtractedPlayer[] = JSON.parse(jsonMatch[0])

    const result = await crossReferenceAndUpsert(
      players, country_code, source_name, age_category, source_url ?? null
    )

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[domestic-scout/ingest-html] error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 }
    )
  }
}
