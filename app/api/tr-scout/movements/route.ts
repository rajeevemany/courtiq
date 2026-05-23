import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface TRSnapshot {
  id: string
  tennisrecruiting_id: string
  name: string
  ranking: number
  rating: string | null
  state: string | null
  committed_school: string | null
  grad_year: number | null
  snapshot_date: string
}

export interface TRMover extends TRSnapshot {
  previous_rank: number
  rank_change: number
  previous_school?: string | null
}

export interface TRCommitment {
  id: string
  tennisrecruiting_id: string
  name: string
  committed_school: string
  grad_year: number | null
  rating: string | null
  state: string | null
  first_seen_date: string
  in_pipeline: boolean
  recruit_id: string | null
}

export interface SophToJuniorPlayer {
  name: string
  state: string | null
  grad_year: number | null
  tennisrecruiting_id: string | null
  soph_rank: number
  junior_rank: number
  improvement: number
  peak_ranking: number | null
}

export interface MovementsResponse {
  rising: TRMover[]
  entered_top30: TRMover[]
  newly_uncommitted: TRMover[]
  top30_uncommitted: TRSnapshot[]
  newly_committed: TRCommitment[]
  snapshot_dates: { current: string | null; previous: string | null }
  soph_to_junior: SophToJuniorPlayer[]
}

async function getNewlyCommitted(recruits: { id: string; name: string }[]): Promise<TRCommitment[]> {
  // Find the most recent first_seen_date in tr_commitment_snapshots
  const { data: latestDateRows } = await supabase
    .from('tr_commitment_snapshots')
    .select('first_seen_date')
    .order('first_seen_date', { ascending: false })
    .limit(1)

  const latestDate = latestDateRows?.[0]?.first_seen_date ?? null
  if (!latestDate) return []

  const { data: rows } = await supabase
    .from('tr_commitment_snapshots')
    .select('*')
    .eq('first_seen_date', latestDate)
    .order('name', { ascending: true })

  return (rows ?? []).map(player => {
    const match = recruits.find(r =>
      r.name.toLowerCase().includes(player.name.toLowerCase()) ||
      player.name.toLowerCase().includes(r.name.toLowerCase())
    )
    return {
      ...player,
      in_pipeline: !!match,
      recruit_id: match?.id ?? null,
    }
  })
}

export async function GET() {
  // Fetch recruits once for pipeline cross-reference
  const { data: recruits } = await supabase.from('recruits').select('id, name')
  const recruitList = recruits ?? []

  // Pre-fetch all committed IDs to exclude from top30_uncommitted
  const { data: committed } = await supabase
    .from('tr_commitment_snapshots')
    .select('tennisrecruiting_id')
  const committedIds = new Set((committed || []).map(c => c.tennisrecruiting_id))

  // Get the two most recent snapshot dates
  const { data: dateRows, error: dateErr } = await supabase
    .from('tr_ranking_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })

  if (dateErr) {
    return NextResponse.json({ error: dateErr.message }, { status: 500 })
  }

  // Distinct dates
  const distinctDates = Array.from(
    new Set((dateRows ?? []).map(r => r.snapshot_date))
  ).sort((a, b) => b.localeCompare(a))

  const currentDate = distinctDates[0] ?? null
  const previousDate = distinctDates[1] ?? null

  if (!currentDate) {
    return NextResponse.json({
      rising: [],
      entered_top30: [],
      newly_uncommitted: [],
      top30_uncommitted: [],
      newly_committed: await getNewlyCommitted(recruitList),
      snapshot_dates: { current: null, previous: null },
      soph_to_junior: [],
    } satisfies MovementsResponse)
  }

  const { data: currentSnaps } = await supabase
    .from('tr_ranking_snapshots')
    .select('*')
    .eq('snapshot_date', currentDate)
    .order('ranking', { ascending: true })

  const currentList: TRSnapshot[] = currentSnaps ?? []

  // Top 30 uncommitted — current only, exclude players committed in tr_commitment_snapshots
  const top30_uncommitted = currentList.filter(
    p => p.ranking <= 30 && !p.committed_school && !committedIds.has(p.tennisrecruiting_id)
  )

  if (!previousDate) {
    const { data: yoyOnly } = await supabase
      .from('junior_profiles')
      .select('id, name, state, committed_year, ranking_yr2, ranking_yr3, peak_ranking, tennisrecruiting_id')
      .not('ranking_yr2', 'is', null)
      .not('ranking_yr3', 'is', null)
      .limit(2500)

    const earlyAfterCommit = (yoyOnly || [])
      .filter(p =>
        p.ranking_yr2 != null &&
        p.ranking_yr3 != null &&
        Number(p.ranking_yr2) > 0 &&
        Number(p.ranking_yr3) > 0 &&
        !committedIds.has(p.tennisrecruiting_id)
      )

    const earlySophToJunior: SophToJuniorPlayer[] = earlyAfterCommit
      .map(p => ({
        name: p.name,
        state: p.state,
        grad_year: p.committed_year,
        tennisrecruiting_id: p.tennisrecruiting_id,
        soph_rank: Number(p.ranking_yr2),
        junior_rank: Number(p.ranking_yr3),
        improvement: Number(p.ranking_yr2) - Number(p.ranking_yr3),
        peak_ranking: p.peak_ranking,
      }))
      .filter(p => p.improvement >= 10)
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 20)

    return NextResponse.json({
      rising: [],
      entered_top30: [],
      newly_uncommitted: [],
      top30_uncommitted,
      newly_committed: await getNewlyCommitted(recruitList),
      snapshot_dates: { current: currentDate, previous: null },
      soph_to_junior: earlySophToJunior,
    } satisfies MovementsResponse)
  }

  const { data: prevSnaps } = await supabase
    .from('tr_ranking_snapshots')
    .select('*')
    .eq('snapshot_date', previousDate)

  const prevMap = new Map((prevSnaps ?? []).map(p => [p.tennisrecruiting_id, p as TRSnapshot]))

  const rising: TRMover[] = []
  const entered_top30: TRMover[] = []
  const newly_uncommitted: TRMover[] = []

  for (const cur of currentList) {
    const prev = prevMap.get(cur.tennisrecruiting_id)
    if (!prev) continue

    const rankChange = prev.ranking - cur.ranking // positive = improved

    if (rankChange >= 5) {
      rising.push({ ...cur, previous_rank: prev.ranking, rank_change: rankChange })
    }

    if (cur.ranking <= 30 && prev.ranking > 30) {
      entered_top30.push({ ...cur, previous_rank: prev.ranking, rank_change: rankChange })
    }

    if (!cur.committed_school && prev.committed_school) {
      newly_uncommitted.push({
        ...cur,
        previous_rank: prev.ranking,
        rank_change: rankChange,
        previous_school: prev.committed_school,
      })
    }
  }

  // Sort rising by rank_change descending
  rising.sort((a, b) => b.rank_change - a.rank_change)

  // ── Soph→Junior year-over-year improvement ──────────────────────────────
  const { data: yearOverYear } = await supabase
    .from('junior_profiles')
    .select('id, name, state, committed_year, ranking_yr2, ranking_yr3, peak_ranking, tennisrecruiting_id')
    .not('ranking_yr2', 'is', null)
    .not('ranking_yr3', 'is', null)
    .limit(2500)

  const afterCommitFilter = (yearOverYear || [])
    .filter(p =>
      p.ranking_yr2 != null &&
      p.ranking_yr3 != null &&
      Number(p.ranking_yr2) > 0 &&
      Number(p.ranking_yr3) > 0 &&
      !committedIds.has(p.tennisrecruiting_id)
    )

  const sophToJunior: SophToJuniorPlayer[] = afterCommitFilter
    .map(p => ({
      name: p.name,
      state: p.state,
      grad_year: p.committed_year,
      tennisrecruiting_id: p.tennisrecruiting_id,
      soph_rank: Number(p.ranking_yr2),
      junior_rank: Number(p.ranking_yr3),
      improvement: Number(p.ranking_yr2) - Number(p.ranking_yr3),
      peak_ranking: p.peak_ranking,
    }))
    .filter(p => p.improvement >= 10)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 20)

  return NextResponse.json({
    rising,
    entered_top30,
    newly_uncommitted,
    top30_uncommitted,
    newly_committed: await getNewlyCommitted(recruitList),
    snapshot_dates: { current: currentDate, previous: previousDate },
    soph_to_junior: sophToJunior,
  } satisfies MovementsResponse)
}
