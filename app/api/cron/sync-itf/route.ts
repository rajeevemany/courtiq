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

const ITF_URL = 'https://www.itftennis.com/tennis/api/PlayerRankApi/GetPlayerRankings?circuitCode=JT&playerTypeCode=B&ageCategoryCode=&juniorRankingType=itf&take=500&skip=0&isOrderAscending=true'

interface ITFPlayer {
  playerId: string
  playerFamilyName: string
  playerGivenName: string
  playerNationalityCode: string
  playerNationality: string
  birthYear: number
  rank: number
  rankMovement: number
  tournamentsPlayed: number
  points: number
  profileLink: string
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch ITF rankings
  const res = await fetch(ITF_URL, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    return NextResponse.json({ error: `ITF API returned ${res.status}` }, { status: 500 })
  }
  const players: ITFPlayer[] = await res.json()

  // 2. Filter to allowed nationalities
  const filtered = players.filter(p => ALLOWED_NATIONALITIES.has(p.playerNationalityCode))

  // 3. Get existing ITF prospects for rank movement reference
  const { data: existingProspects } = await supabase
    .from('scouting_prospects')
    .select('itf_player_id, itf_ranking')
    .eq('source', 'itf')
  const prospectRankMap = new Map(existingProspects?.map(p => [p.itf_player_id, p.itf_ranking]) || [])

  // 4. Build upsert records
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

  // 5. Upsert all (ON CONFLICT on itf_player_id)
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
    total_fetched: players.length,
    after_filter: filtered.length,
    upserted: toUpsert.length,
  })
}
