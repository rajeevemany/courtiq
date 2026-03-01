import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/recruits/match-itf  { recruit_id }
// Searches itf_players_cache for a name match and, if found, saves the
// itf_player_id back to the recruit row.
export async function POST(req: NextRequest) {
  const { recruit_id } = await req.json()
  if (!recruit_id) {
    return NextResponse.json({ error: 'recruit_id required' }, { status: 400 })
  }

  const { data: recruit, error: rErr } = await supabase
    .from('recruits')
    .select('name, nationality')
    .eq('id', recruit_id)
    .single()

  if (rErr || !recruit) {
    return NextResponse.json({ error: 'Recruit not found' }, { status: 404 })
  }

  const fullName = (recruit.name as string).trim()
  const parts    = fullName.split(/\s+/)
  const lastName = parts[parts.length - 1]

  // 1. Try exact full-name match (case-insensitive)
  const { data: exactMatches } = await supabase
    .from('itf_players_cache')
    .select('itf_player_id, name, ranking, nationality')
    .ilike('name', fullName)
    .limit(1)

  let match = exactMatches?.[0] ?? null

  // 2. Fallback: last-name fuzzy search, preferring nationality match
  if (!match) {
    const { data: fuzzy } = await supabase
      .from('itf_players_cache')
      .select('itf_player_id, name, ranking, nationality')
      .ilike('name', `%${lastName}%`)
      .limit(20)

    if (fuzzy && fuzzy.length > 0) {
      const byNationality = fuzzy.find(p => p.nationality === recruit.nationality)
      match = byNationality ?? fuzzy[0]
    }
  }

  if (!match) {
    return NextResponse.json({ success: true, matched: false })
  }

  // Save itf_player_id back to the recruit
  const { error: updateErr } = await supabase
    .from('recruits')
    .update({ itf_player_id: match.itf_player_id })
    .eq('id', recruit_id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    matched: true,
    itf_player_id: match.itf_player_id,
    name: match.name,
    ranking: match.ranking,
  })
}
