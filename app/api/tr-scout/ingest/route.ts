import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface IngestPlayer {
  tennisrecruiting_id: string
  name: string
  ranking: number
  rating: string | null
  state: string | null
  committed_school: string | null
}

export async function POST(req: NextRequest) {
  try {
    const { players, snapshot_date, grad_year } = await req.json()

    if (!Array.isArray(players) || players.length === 0) {
      return NextResponse.json({ error: 'No players provided' }, { status: 400 })
    }
    if (!snapshot_date) {
      return NextResponse.json({ error: 'snapshot_date is required' }, { status: 400 })
    }

    const rows = (players as IngestPlayer[]).map(p => ({
      tennisrecruiting_id: p.tennisrecruiting_id,
      name: p.name,
      ranking: p.ranking,
      rating: p.rating ?? null,
      state: p.state ?? null,
      committed_school: p.committed_school ?? null,
      snapshot_date,
      ...(grad_year != null ? { grad_year } : {}),
    }))

    const { error: upsertError } = await supabase
      .from('tr_ranking_snapshots')
      .upsert(rows, { onConflict: 'tennisrecruiting_id,snapshot_date' })

    if (upsertError) {
      console.error('[tr-scout/ingest] upsert error:', upsertError.message)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Get the previous snapshot date (most recent before snapshot_date)
    const { data: prevDates } = await supabase
      .from('tr_ranking_snapshots')
      .select('snapshot_date')
      .lt('snapshot_date', snapshot_date)
      .order('snapshot_date', { ascending: false })
      .limit(1)

    const prevDate = prevDates?.[0]?.snapshot_date ?? null

    let movers: object[] = []
    let entered_top30: object[] = []
    let newly_uncommitted: object[] = []

    if (prevDate) {
      const { data: todaySnaps } = await supabase
        .from('tr_ranking_snapshots')
        .select('*')
        .eq('snapshot_date', snapshot_date)

      const { data: prevSnaps } = await supabase
        .from('tr_ranking_snapshots')
        .select('*')
        .eq('snapshot_date', prevDate)

      const prevMap = new Map((prevSnaps ?? []).map(p => [p.tennisrecruiting_id, p]))

      for (const cur of todaySnaps ?? []) {
        const prev = prevMap.get(cur.tennisrecruiting_id)
        if (!prev) continue

        const rankChange = prev.ranking - cur.ranking // positive = improved

        if (rankChange >= 5) {
          movers.push({ ...cur, previous_rank: prev.ranking, rank_change: rankChange })
        }

        if (cur.ranking <= 30 && prev.ranking > 30) {
          entered_top30.push({ ...cur, previous_rank: prev.ranking, rank_change: rankChange })
        }

        if (!cur.committed_school && prev.committed_school) {
          newly_uncommitted.push({ ...cur, previous_school: prev.committed_school })
        }
      }
    }

    return NextResponse.json({ saved: rows.length, movers, entered_top30, newly_uncommitted })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[tr-scout/ingest]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
