import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CommitmentPlayer {
  tennisrecruiting_id: string
  name: string
  committed_school: string
  grad_year?: number | null
  rating?: string | null
  state?: string | null
  conference?: string | null
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

    const rows = (players as CommitmentPlayer[]).map(p => ({
      tennisrecruiting_id: p.tennisrecruiting_id,
      name: p.name,
      committed_school: p.committed_school,
      grad_year: p.grad_year ?? grad_year ?? null,
      rating: p.rating ?? null,
      state: p.state ?? null,
      conference: p.conference ?? null,
      first_seen_date: snapshot_date,
    }))

    // ON CONFLICT DO NOTHING — first_seen_date stays as originally captured
    const { error: upsertError } = await supabase
      .from('tr_commitment_snapshots')
      .upsert(rows, { onConflict: 'tennisrecruiting_id', ignoreDuplicates: true })

    if (upsertError) {
      console.error('[ingest-commitments] upsert error:', upsertError.message)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Fetch players first seen today (newly committed)
    const { data: newlyCommitted } = await supabase
      .from('tr_commitment_snapshots')
      .select('*')
      .eq('first_seen_date', snapshot_date)

    if (!newlyCommitted || newlyCommitted.length === 0) {
      return NextResponse.json({ saved: rows.length, newly_committed: [], in_pipeline: [] })
    }

    // Cross-reference against recruits table by name
    const { data: recruits } = await supabase
      .from('recruits')
      .select('id, name')

    const recruitList = recruits ?? []

    const inPipeline: string[] = []
    const newlyCommittedWithFlag = newlyCommitted.map(player => {
      const match = recruitList.find(r =>
        r.name.toLowerCase().includes(player.name.toLowerCase()) ||
        player.name.toLowerCase().includes(r.name.toLowerCase())
      )
      const flag = !!match
      if (flag) inPipeline.push(player.tennisrecruiting_id)
      return { ...player, in_pipeline: flag, recruit_id: match?.id ?? null }
    })

    return NextResponse.json({
      saved: rows.length,
      newly_committed: newlyCommittedWithFlag,
      in_pipeline: inPipeline,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ingest-commitments]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
