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

interface ITFCacheRow { itf_player_id: string; ranking: number; name: string }

async function findITFMatch(last_name: string, first_name: string): Promise<ITFCacheRow | null> {
  const sel = 'itf_player_id, ranking, name'
  console.log('[itf-match] searching for:', last_name, first_name)

  // Strategy 1: substring on full last name
  const { data: s1 } = await supabase
    .from('itf_players_cache')
    .select(sel)
    .ilike('name', `%${last_name}%`)
    .limit(3)
  if (s1?.length) {
    console.log('[itf-match] s1 result:', s1[0].name, s1[0].ranking)
    return s1[0]
  }

  // Strategy 2: each part of a hyphenated last name
  if (last_name.includes('-')) {
    for (const part of last_name.split('-')) {
      if (part.length < 3) continue
      const { data: s2 } = await supabase
        .from('itf_players_cache')
        .select(sel)
        .ilike('name', `%${part}%`)
        .limit(3)
      if (s2?.length) {
        console.log('[itf-match] s2 result:', s2[0].name, s2[0].ranking)
        return s2[0]
      }
    }
  }

  // Strategy 3: first_name AND first part of last_name (AND-combined ilike)
  if (first_name) {
    const lastPart = last_name.split('-')[0]
    const { data: s3 } = await supabase
      .from('itf_players_cache')
      .select(sel)
      .ilike('name', `%${first_name}%`)
      .ilike('name', `%${lastPart}%`)
      .limit(1)
    if (s3?.length) {
      console.log('[itf-match] s3 result:', s3[0].name, s3[0].ranking)
      return s3[0]
    }
  }

  console.log('[itf-match] no match found for:', last_name, first_name)
  return null
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

  // Clear stale records for this country/age/date before inserting fresh batch
  await supabase
    .from('domestic_rankings')
    .delete()
    .eq('country_code', country_code)
    .eq('age_category', age_category)
    .eq('snapshot_date', snapshot_date)

  const rows = await Promise.all(
    players.map(async (p) => {
      const player_name = `${p.first_name} ${p.last_name}`.trim()

      const itfMatch = await findITFMatch(p.last_name, p.first_name)
      const itf_player_id = itfMatch?.itf_player_id ?? null
      const itf_ranking: number | null = itfMatch?.ranking ?? null
      const itf_name: string | null = itfMatch?.name ?? null

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
        itf_name,
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

    console.log('[ingest-pdf] fetching PDF from:', pdf_url)

    // Fetch PDF
    const pdfRes = await fetch(pdf_url)
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`)
    const arrayBuffer = await pdfRes.arrayBuffer()
    console.log('[ingest-pdf] PDF fetched, size:', arrayBuffer.byteLength)

    const base64 = Buffer.from(arrayBuffer).toString('base64')
    console.log('[ingest-pdf] base64 length:', base64.length)

    console.log('[ingest-pdf] calling Claude...')

    // Extract rankings via Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
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

    console.log('[ingest-pdf] Claude response type:', message.content?.[0]?.type)
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[ingest-pdf] Claude text preview:', text?.slice(0, 300))
    let parsed: unknown[]
    try {
      // Try direct parse first
      parsed = JSON.parse(text.trim())
    } catch {
      // Extract array and fix truncated JSON by finding last complete object
      const arrayStart = text.indexOf('[')
      if (arrayStart === -1) {
        console.log('[ingest-pdf] No JSON array found. Raw:', text.slice(0, 1000))
        return NextResponse.json({
          error: 'No JSON array found in Claude response',
          raw_response: text.slice(0, 1000),
          text_length: text.length,
        }, { status: 500 })
      }
      let jsonStr = text.slice(arrayStart)
      if (!jsonStr.trimEnd().endsWith(']')) {
        const lastBrace = jsonStr.lastIndexOf('}')
        if (lastBrace !== -1) {
          jsonStr = jsonStr.slice(0, lastBrace + 1) + ']'
        }
      }
      parsed = JSON.parse(jsonStr)
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json({
        error: 'Claude did not return a JSON array',
        raw_response: text.slice(0, 1000),
        text_length: text.length,
      }, { status: 500 })
    }

    // Deduplicate by last_name+first_name (case-insensitive) — handles double entries in PDF
    const seen = new Set<string>()
    const players = (parsed as ExtractedPlayer[]).filter(p => {
      const key = `${p.last_name}${p.first_name}`.toLowerCase().replace(/\s/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const result = await crossReferenceAndUpsert(
      players, country_code, source_name, age_category, pdf_url
    )

    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[ingest-pdf] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
