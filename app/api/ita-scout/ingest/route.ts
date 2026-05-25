import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RankingRow {
  rank: number
  name: string
  school: string | null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rankings, season, match_format, gender, date, source_url } = body

    if (!Array.isArray(rankings) || rankings.length === 0) {
      return NextResponse.json({ success: false, error: 'No rankings provided' }, { status: 400 })
    }
    if (!season) {
      return NextResponse.json({ success: false, error: 'season required' }, { status: 400 })
    }

    const rows = (rankings as RankingRow[]).map(r => ({
      player_name:  String(r.name).trim(),
      school:       r.school ? String(r.school).trim() : null,
      ita_rank:     Number(r.rank),
      season:       String(season),
      match_format: String(match_format || 'SINGLES').toUpperCase(),
      gender:       String(gender || 'M').toUpperCase(),
      snapshot_date: date || new Date().toISOString().split('T')[0],
      source_url:   source_url || null,
    }))

    const { error } = await supabase
      .from('ita_rankings')
      .upsert(rows, { onConflict: 'player_name,season,match_format,gender' })

    if (error) throw error

    return NextResponse.json({ success: true, saved: rows.length })
  } catch (error) {
    console.error('[ita-scout/ingest]', error)
    return NextResponse.json({ success: false, error: 'Failed to save rankings' }, { status: 500 })
  }
}
