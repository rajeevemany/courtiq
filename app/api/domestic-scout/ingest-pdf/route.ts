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

      // Cross-reference ITF cache by last name
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

export async function POST(request: Request) {
  try {
    const { pdf_url, country_code, source_name, age_category } = await request.json()

    if (!pdf_url || !country_code || !source_name || !age_category) {
      return NextResponse.json(
        { error: 'Missing required fields: pdf_url, country_code, source_name, age_category' },
        { status: 400 }
      )
    }

    // Fetch PDF
    const pdfRes = await fetch(pdf_url)
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`)
    const base64 = Buffer.from(await pdfRes.arrayBuffer()).toString('base64')

    // Extract rankings via Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            {
              type: 'text',
              text: `You are extracting data from a German tennis ranking PDF (DTB Rangliste).
The format is: Rang | Name | Vorname | NAT | ID-Nr. | VBD | Verein | Punkte

Extract ALL players. Return ONLY a raw JSON array with no markdown, no explanation, no code fences. Start your response with [ and end with ].

Each object must have exactly these fields:
{
  "rank": <the Rang number as integer>,
  "last_name": <the Name field>,
  "first_name": <the Vorname field>,
  "nationality": <the NAT field, e.g. GER>,
  "birth_year": null,
  "points": <the Punkte number>
}

Example of first few rows you should extract:
[
  {"rank": 1, "last_name": "Dedura", "first_name": "Diego", "nationality": "GER", "birth_year": null, "points": 17516.0},
  {"rank": 2, "last_name": "McDonald", "first_name": "Niels", "nationality": "GER", "birth_year": null, "points": 9338.0}
]`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log('[ingest-pdf] Claude raw response:', text.slice(0, 500))
      throw new Error('Claude did not return a JSON array')
    }
    const raw = jsonMatch[0]

    const players: ExtractedPlayer[] = JSON.parse(raw)

    const result = await crossReferenceAndUpsert(
      players, country_code, source_name, age_category, pdf_url
    )

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[domestic-scout/ingest-pdf] error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 }
    )
  }
}
