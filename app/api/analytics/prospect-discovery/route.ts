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

    const { data: columbiaCareers, error: err2 } = await supabase
      .from('college_careers')
      .select('junior_profile_id, career_singles_wins, career_singles_losses, peak_ita_ranking')
      .in('junior_profile_id', juniorIds.length ? juniorIds : ['00000000-0000-0000-0000-000000000000'])

    if (err2) throw err2

    const careerMap = new Map(
      (columbiaCareers || []).map((c) => [c.junior_profile_id, c])
    )

    type BandData = { wins: number[]; losses: number[] }
    const bandMap: Record<string, BandData> = Object.fromEntries(
      BAND_ORDER.map((b) => [b, { wins: [], losses: [] }])
    )

    for (const junior of columbiaJuniors || []) {
      const career = careerMap.get(junior.id)
      if (!career) continue
      const band = getRankingBand(junior.peak_ranking)
      bandMap[band].wins.push(career.career_singles_wins ?? 0)
      bandMap[band].losses.push(career.career_singles_losses ?? 0)
    }

    const rankingOutcomes = BAND_ORDER.map((band) => {
      const { wins, losses } = bandMap[band]
      const count = wins.length
      return {
        band,
        count,
        avgWins: count ? Math.round(wins.reduce((a, b) => a + b, 0) / count) : 0,
        avgLosses: count ? Math.round(losses.reduce((a, b) => a + b, 0) / count) : 0,
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

    let eligibleProspects: EligibleProspect[] = []

    if (latestDate) {
      const { data: snapProspects } = await supabase
        .from('tr_ranking_snapshots')
        .select('*')
        .eq('snapshot_date', latestDate)
        .is('committed_school', null)
        .lte('ranking', 30)
        .order('ranking', { ascending: true })

      eligibleProspects = (snapProspects ?? []).map(p => ({
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
