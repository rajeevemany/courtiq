import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_NATIONALITIES = new Set([
  'USA','GBR','AUS','CAN','NZL','IRL','RSA','BAH',
  'SUI','SWE','NOR','DEN','NED','GER','AUT','FIN','BEL',
  'IND','HKG','SGP','HUN','SVK','ESP','FRA','ITA',
])

interface ITFPlayer {
  playerId: string
  playerFamilyName: string
  playerGivenName: string
  playerNationalityCode: string
  rank: number
  rankMovement: number
}

// POST /api/cron/sync-itf
// Body: { players: ITFPlayer[] } — fetched client-side by the coach via /itf-import
export async function POST(request: Request) {
  let body: { players: ITFPlayer[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { players } = body
  if (!Array.isArray(players) || players.length === 0) {
    return NextResponse.json({ error: 'Body must contain a non-empty players array' }, { status: 400 })
  }

  // Re-apply nationality filter server-side as a safety net
  const filtered = players.filter(p => ALLOWED_NATIONALITIES.has(p.playerNationalityCode))

  // Get existing ITF prospects to calculate rank movement
  const { data: existingProspects } = await supabase
    .from('scouting_prospects')
    .select('itf_player_id, itf_ranking')
    .eq('source', 'itf')
  const prospectRankMap = new Map(existingProspects?.map(p => [p.itf_player_id, p.itf_ranking]) || [])

  const toUpsert = filtered.map(p => {
    const prevRank = prospectRankMap.get(p.playerId) ?? p.rank
    const movement = p.rankMovement
    return {
      itf_player_id: p.playerId,
      name: `${p.playerGivenName} ${p.playerFamilyName}`,
      itf_ranking: p.rank,
      nationality: p.playerNationalityCode,
      rank_movement: movement,
      is_rising: movement <= -10,
      source: 'itf',
      last_synced_at: new Date().toISOString(),
    }
  })

  const { error } = await supabase
    .from('scouting_prospects')
    .upsert(toUpsert, { onConflict: 'itf_player_id' })

  if (error) {
    console.error('ITF upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    run_at: new Date().toISOString(),
    total_received: players.length,
    after_filter: filtered.length,
    upserted: toUpsert.length,
  })
}
