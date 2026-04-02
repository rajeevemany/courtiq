import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ACADEMY_KEYWORDS = [
  'img academy', 'evert tennis academy', 'sanchez-casal academy',
  'saddlebrook preparatory', 'nick bollettieri', 'usta training center',
  'img academies', 'international tennis academy', 'tga',
]

function isAcademy(school: string | null): boolean {
  if (!school) return false
  const lower = school.toLowerCase()
  return ACADEMY_KEYWORDS.some(k => lower.includes(k))
}

function getRankingBand(ranking: number | null): string {
  if (!ranking) return '101+'
  if (ranking <= 15) return '1–15'
  if (ranking <= 30) return '16–30'
  if (ranking <= 50) return '31–50'
  if (ranking <= 100) return '51–100'
  return '101+'
}

const BAND_ORDER = ['1–15', '16–30', '31–50', '51–100', '101+']

export async function GET() {
  try {
    // ── a. RANKING-TO-OUTCOME MODEL ──────────────────────────────────────────
    const { data: columbiaJuniors, error: err1 } = await supabase
      .from('junior_profiles')
      .select('id, name, rating, peak_ranking')
      .eq('committed_school', 'Columbia')
      .not('peak_ranking', 'is', null)

    if (err1) throw err1

    const juniorIds = (columbiaJuniors || []).map((j) => j.id)

    const { data: columbiaCareers, error: err2a } = await supabase
      .from('college_careers')
      .select('junior_profile_id, career_singles_wins, career_singles_losses, peak_ita_ranking')
      .in('junior_profile_id', juniorIds.length ? juniorIds : ['00000000-0000-0000-0000-000000000000'])

    if (err2a) throw err2a

    const careerMap = new Map(
      (columbiaCareers || []).map((c) => [c.junior_profile_id, c])
    )

    type BandData = { wins: number[]; losses: number[] }
    const colBandMap: Record<string, BandData> = Object.fromEntries(
      BAND_ORDER.map((b) => [b, { wins: [], losses: [] }])
    )

    type BandPlayer = {
      name: string; school: string; peak_ranking: number | null
      career_singles_wins: number; career_singles_losses: number
      peak_ita_ranking: number | null; career_summary: string | null
    }

    for (const junior of columbiaJuniors || []) {
      const career = careerMap.get(junior.id)
      if (!career || career.career_singles_wins == null) continue
      const band = getRankingBand(junior.peak_ranking)
      colBandMap[band].wins.push(career.career_singles_wins)
      colBandMap[band].losses.push(career.career_singles_losses ?? 0)
    }

    // All-schools bucketing — fetch careers first, then join rankings
    const { data: allCareers, error: err2b } = await supabase
      .from('college_careers')
      .select('junior_profile_id, career_singles_wins, career_singles_losses, school, career_summary, peak_ita_ranking')
      .not('career_singles_wins', 'is', null)

    if (err2b) throw err2b

    const careerJuniorIds = (allCareers || []).map((c) => c.junior_profile_id)

    const { data: careerJuniors, error: err2c } = await supabase
      .from('junior_profiles')
      .select('id, peak_ranking, name')
      .in('id', careerJuniorIds.length ? careerJuniorIds : ['00000000-0000-0000-0000-000000000000'])

    if (err2c) throw err2c

    const juniorRankMap = new Map((careerJuniors || []).map((j) => [j.id, j.peak_ranking]))
    const juniorNameMap = new Map((careerJuniors || []).map((j) => [j.id, j.name]))

    const allBandMap: Record<string, BandData> = Object.fromEntries(
      BAND_ORDER.map((b) => [b, { wins: [], losses: [] }])
    )
    const allBandPlayers: Record<string, BandPlayer[]> = Object.fromEntries(
      BAND_ORDER.map((b) => [b, []])
    )

    for (const career of allCareers || []) {
      const peak_ranking = juniorRankMap.get(career.junior_profile_id)
      if (peak_ranking == null) continue
      const band = getRankingBand(peak_ranking)
      allBandMap[band].wins.push(career.career_singles_wins!)
      allBandMap[band].losses.push(career.career_singles_losses ?? 0)
      allBandPlayers[band].push({
        name: juniorNameMap.get(career.junior_profile_id) ?? 'Unknown',
        school: career.school,
        peak_ranking,
        career_singles_wins: career.career_singles_wins!,
        career_singles_losses: career.career_singles_losses ?? 0,
        peak_ita_ranking: career.peak_ita_ranking ?? null,
        career_summary: career.career_summary ?? null,
      })
    }

    const rankingOutcomes = BAND_ORDER.map((band) => {
      const col = colBandMap[band]
      const all = allBandMap[band]
      const colCount = col.wins.length
      const allCount = all.wins.length
      const players = [...allBandPlayers[band]].sort(
        (a, b) => b.career_singles_wins - a.career_singles_wins
      )
      return {
        band,
        columbia_count: colCount,
        columbia_avg_wins: colCount ? Math.round(col.wins.reduce((a, b) => a + b, 0) / colCount) : 0,
        columbia_avg_losses: colCount ? Math.round(col.losses.reduce((a, b) => a + b, 0) / colCount) : 0,
        all_count: allCount,
        all_avg_wins: allCount ? Math.round(all.wins.reduce((a, b) => a + b, 0) / allCount) : 0,
        all_avg_losses: allCount ? Math.round(all.losses.reduce((a, b) => a + b, 0) / allCount) : 0,
        players,
      }
    })

    // ── b. UNCOMMITTED PROSPECTS ─────────────────────────────────────────────
    const { data: latestSnap } = await supabase
      .from('tr_ranking_snapshots')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)

    const latestDate = latestSnap?.[0]?.snapshot_date ?? null

interface EligibleProspect {
  id: string
  name: string
  national_ranking: number | null
  nationality: string | null
  location: string | null
  high_school: string | null
  fit_score: number | null
  grad_year: number | null
  utr_rating: number | null
}

    // Pre-fetch committed IDs to exclude from eligible prospects
    const { data: committedProspects } = await supabase
      .from('tr_commitment_snapshots')
      .select('tennisrecruiting_id')
    const committedProspectIds = new Set(
      (committedProspects || []).map(c => c.tennisrecruiting_id)
    )

    let eligibleProspects: EligibleProspect[] = []

    if (latestDate) {
      const { data: snapProspects } = await supabase
        .from('tr_ranking_snapshots')
        .select('tennisrecruiting_id, name, ranking, state, grad_year')
        .eq('snapshot_date', latestDate)
        .is('committed_school', null)
        .lte('ranking', 30)
        .order('ranking', { ascending: true })

      eligibleProspects = (snapProspects ?? [])
        .filter(p => !committedProspectIds.has(p.tennisrecruiting_id))
        .map(p => ({
          id: p.tennisrecruiting_id,
          name: p.name,
          national_ranking: p.ranking,
          nationality: p.state,
          location: p.state,
          high_school: null,
          fit_score: null,
          grad_year: p.grad_year,
          utr_rating: null,
        }))
    }

    // ── c. COMPARABLE PLAYERS ────────────────────────────────────────────────
    // Fetch all non-null-ranked historical juniors with careers in one query
    const { data: historicalJuniors } = await supabase
      .from('junior_profiles')
      .select('id, name, rating, peak_ranking, committed_school, country')
      .not('peak_ranking', 'is', null)
      .not('committed_school', 'is', null)

    const historicalCareerIds = (historicalJuniors || []).map((j) => j.id)

    const { data: historicalCareers } = await supabase
      .from('college_careers')
      .select('junior_profile_id, career_singles_wins, career_singles_losses, school')
      .in(
        'junior_profile_id',
        historicalCareerIds.length
          ? historicalCareerIds
          : ['00000000-0000-0000-0000-000000000000']
      )

    const historicalCareerMap = new Map(
      (historicalCareers || []).map((c) => [c.junior_profile_id, c])
    )

    const historicalWithCareers = (historicalJuniors || []).filter((j) =>
      historicalCareerMap.has(j.id)
    )

    const prospectsWithData = eligibleProspects.map((prospect) => {
      const useRanking = prospect.national_ranking

      const comparables = useRanking
        ? historicalWithCareers
            .filter(
              (h) =>
                Math.abs(h.peak_ranking - useRanking) <= 10 &&
                (prospect.nationality ? h.country === prospect.nationality : true)
            )
            .slice(0, 3)
        : []

      const comparableDetails = comparables.map((h) => {
        const c = historicalCareerMap.get(h.id)!
        return {
          name: h.name,
          school: h.committed_school,
          wins: c.career_singles_wins ?? 0,
          losses: c.career_singles_losses ?? 0,
        }
      })

      const avgWins =
        comparableDetails.length
          ? Math.round(comparableDetails.reduce((s, c) => s + c.wins, 0) / comparableDetails.length)
          : 0
      const avgLosses =
        comparableDetails.length
          ? Math.round(comparableDetails.reduce((s, c) => s + c.losses, 0) / comparableDetails.length)
          : 0

      return {
        ...prospect,
        isAcademy: isAcademy(prospect.high_school),
        comparables: comparableDetails,
        comparableSummary:
          comparableDetails.length > 0
            ? `Similar to ${comparableDetails.length} player${comparableDetails.length > 1 ? 's' : ''} who averaged ${avgWins}–${avgLosses}`
            : null,
      }
    })

    // ── Pipeline health ──────────────────────────────────────────────────────
    const top15Count = eligibleProspects.filter(
      (p) => (p as { national_ranking: number }).national_ranking <= 15
    ).length
    const band1630Count = eligibleProspects.filter((p) => {
      const r = (p as { national_ranking: number }).national_ranking
      return r > 15 && r <= 30
    }).length

    // ── d. RISING PLAYERS ────────────────────────────────────────────────────
    const { data: snapDates } = await supabase
      .from('tr_ranking_snapshots')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })

    const distinctSnapDates = Array.from(
      new Set((snapDates ?? []).map(r => r.snapshot_date))
    ).sort((a, b) => b.localeCompare(a))

    const risingCurrentDate = distinctSnapDates[0] ?? null
    const risingPreviousDate = distinctSnapDates[1] ?? null

    const { data: committedRows } = await supabase
      .from('tr_commitment_snapshots')
      .select('tennisrecruiting_id')
    const committedSet = new Set((committedRows || []).map(c => c.tennisrecruiting_id))

    let risingPlayers: {
      name: string; tennisrecruiting_id: string
      current_rank: number; previous_rank: number; rank_change: number
      state: string | null; grad_year: number | null
    }[] = []

    if (risingCurrentDate && risingPreviousDate) {
      const { data: risingCurrent } = await supabase
        .from('tr_ranking_snapshots')
        .select('tennisrecruiting_id, name, ranking, state, grad_year, committed_school')
        .eq('snapshot_date', risingCurrentDate)
        .is('committed_school', null)

      const { data: risingPrev } = await supabase
        .from('tr_ranking_snapshots')
        .select('tennisrecruiting_id, ranking')
        .eq('snapshot_date', risingPreviousDate)

      const prevRankMap = new Map((risingPrev ?? []).map(p => [p.tennisrecruiting_id, p.ranking]))

      risingPlayers = (risingCurrent ?? [])
        .filter(p => !committedSet.has(p.tennisrecruiting_id))
        .map(p => {
          const prevRank = prevRankMap.get(p.tennisrecruiting_id)
          if (prevRank == null) return null
          const rankChange = prevRank - p.ranking
          if (rankChange < 3) return null
          return {
            name: p.name,
            tennisrecruiting_id: p.tennisrecruiting_id,
            current_rank: p.ranking,
            previous_rank: prevRank,
            rank_change: rankChange,
            state: p.state,
            grad_year: p.grad_year,
          }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => b.rank_change - a.rank_change)
        .slice(0, 10)
    }

    // ── e. UNDERVALUED PLAYERS ────────────────────────────────────────────────
    const top15AllAvgWins = (() => {
      const band = allBandMap['1–15']
      return band.wins.length
        ? band.wins.reduce((a, b) => a + b, 0) / band.wins.length
        : 0
    })()
    const threshold = top15AllAvgWins * 0.75

    // Build comparable lookup from already-fetched allCareers + careerJuniors
    // career → peak_ranking already in juniorRankMap

    type CompPlayer = {
      name: string; school: string; peak_ranking: number
      career_singles_wins: number; career_singles_losses: number
    }

    let undervaluedPlayers: {
      name: string; current_rank: number; state: string | null
      grad_year: number | null; comparable_avg_wins: number; comparable_count: number
      comparable_players: CompPlayer[]
    }[] = []

    if (latestDate) {
      const { data: band1630Snaps } = await supabase
        .from('tr_ranking_snapshots')
        .select('tennisrecruiting_id, name, ranking, state, grad_year')
        .eq('snapshot_date', latestDate)
        .is('committed_school', null)
        .gte('ranking', 16)
        .lte('ranking', 30)

      // Build in-memory comparable lookup: peak_ranking → player details
      type RankEntry = { wins: number; losses: number; name: string; school: string; peak_ranking: number }
      const rankToPlayers = new Map<number, RankEntry[]>()
      for (const career of allCareers || []) {
        const pr = juniorRankMap.get(career.junior_profile_id)
        if (pr == null) continue
        if (!rankToPlayers.has(pr)) rankToPlayers.set(pr, [])
        rankToPlayers.get(pr)!.push({
          wins: career.career_singles_wins!,
          losses: career.career_singles_losses ?? 0,
          name: juniorNameMap.get(career.junior_profile_id) ?? 'Unknown',
          school: career.school,
          peak_ranking: pr,
        })
      }

      undervaluedPlayers = (band1630Snaps ?? [])
        .filter(p => !committedSet.has(p.tennisrecruiting_id))
        .map(p => {
          const lo = p.ranking - 10
          const hi = p.ranking + 10
          const compEntries: RankEntry[] = []
          for (const [pr, entries] of rankToPlayers) {
            if (pr >= lo && pr <= hi) compEntries.push(...entries)
          }
          if (compEntries.length === 0) return null
          const avgWins = compEntries.reduce((a, b) => a + b.wins, 0) / compEntries.length
          if (avgWins < threshold) return null
          const comparable_players = [...compEntries]
            .sort((a, b) => b.wins - a.wins)
            .slice(0, 5)
            .map(e => ({
              name: e.name,
              school: e.school,
              peak_ranking: e.peak_ranking,
              career_singles_wins: e.wins,
              career_singles_losses: e.losses,
            }))
          return {
            name: p.name,
            current_rank: p.ranking,
            state: p.state,
            grad_year: p.grad_year,
            comparable_avg_wins: Math.round(avgWins),
            comparable_count: compEntries.length,
            comparable_players,
          }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => b.comparable_avg_wins - a.comparable_avg_wins)
        .slice(0, 8)
    }

    return NextResponse.json({
      success: true,
      data: {
        rankingOutcomes,
        prospects: prospectsWithData,
        pipelineHealth: {
          total: eligibleProspects.length,
          top15: top15Count,
          band1630: band1630Count,
        },
        risingPlayers,
        undervaluedPlayers,
      },
    })
  } catch (error) {
    console.error('[prospect-discovery] error:', error)
    return NextResponse.json(
      { error: (error as Error).message || JSON.stringify(error) },
      { status: 500 }
    )
  }
}
