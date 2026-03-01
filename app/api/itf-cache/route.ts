import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ITFPlayer {
  playerId: string
  playerFamilyName: string
  playerGivenName: string
  playerNationalityCode: string
  rank: number
  rankMovement: number
  birthYear?: number
}

// POST /api/itf-cache  { players: ITFPlayer[] }
// Upserts all players to itf_players_cache. Fire-and-forget friendly.
export async function POST(req: NextRequest) {
  const { players } = await req.json()

  if (!Array.isArray(players) || players.length === 0) {
    return NextResponse.json({ error: 'players array required' }, { status: 400 })
  }

  const rows = players.map((p: ITFPlayer) => ({
    itf_player_id: p.playerId,
    name: `${p.playerGivenName} ${p.playerFamilyName}`,
    nationality: p.playerNationalityCode,
    ranking: p.rank,
    rank_movement: p.rankMovement,
    birth_year: p.birthYear ?? null,
    last_synced: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('itf_players_cache')
    .upsert(rows, { onConflict: 'itf_player_id' })

  if (error) {
    console.error('itf-cache upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, cached: rows.length })
}
