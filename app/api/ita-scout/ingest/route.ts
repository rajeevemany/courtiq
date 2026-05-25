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

const cleanName = (raw: string) => {
  return raw
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => {
      if (word === word.toUpperCase() && word.length > 1) {
        return word.charAt(0) + word.slice(1).toLowerCase()
      }
      return word
    })
    .join(' ')
}

const cleanSchool = (s: string) => s?.replace(/\s*\([MF]\)\s*$/, '').trim()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rankings, season, match_format, gender, date } = body

    console.log('[ita-ingest] first 3 rankings:', JSON.stringify(body.rankings?.slice(0, 3)))

    if (!Array.isArray(rankings) || rankings.length === 0) {
      return NextResponse.json({ success: false, error: 'No rankings provided' }, { status: 400 })
    }
    if (!season) {
      return NextResponse.json({ success: false, error: 'season required' }, { status: 400 })
    }

    const rows = (rankings as RankingRow[]).map(r => ({
      player_name:  cleanName(String(r.name)),
      school:       r.school ? cleanSchool(String(r.school)) : null,
      ita_rank:     Number(r.rank),
      season:       String(season),
      match_format: String(match_format || 'SINGLES').toUpperCase(),
      gender:       String(gender || 'M').toUpperCase(),
      snapshot_date: date || new Date().toISOString().split('T')[0],
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
