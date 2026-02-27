import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Get all recruits with UTR history and ranking history
    const { data: recruits, error } = await supabase
      .from('recruits')
      .select(`
        *,
        utr_history (
          utr_rating,
          recorded_date,
          source
        ),
        ranking_history (
          national_ranking,
          recorded_date,
          source
        )
      `)
      .order('national_ranking', { ascending: true })

    if (error) throw error

    // Get program profile for targeting criteria
    const { data: profile } = await supabase
      .from('program_profiles')
      .select('*')
      .single()

    // Get all scouting prospects not yet in the pipeline
    const { data: prospects } = await supabase
      .from('scouting_prospects')
      .select('*')
      .order('national_ranking', { ascending: true, nullsFirst: false })

    // Calculate UTR trend and ranking trend for each recruit
    const recruitsWithTrends = (recruits || []).map(recruit => {
      // ---- UTR trend ----
      const utrHistory = recruit.utr_history || []
      const sortedUtr = [...utrHistory].sort(
        (a: { recorded_date: string }, b: { recorded_date: string }) =>
          new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime()
      )

      let utr_trend = 'stable'
      let utr_trend_value = 0

      if (sortedUtr.length >= 2) {
        const oldest = sortedUtr[0].utr_rating
        const newest = sortedUtr[sortedUtr.length - 1].utr_rating
        utr_trend_value = Math.round((newest - oldest) * 100) / 100
        if (utr_trend_value >= 0.5) utr_trend = 'rising'
        else if (utr_trend_value <= -0.5) utr_trend = 'falling'
      }

      // ---- Ranking trend ----
      // Lower rank number = better. "rising" means rank number decreased (improved) by ≥2.
      const rankingHistory = recruit.ranking_history || []
      const sortedRanking = [...rankingHistory].sort(
        (a: { recorded_date: string }, b: { recorded_date: string }) =>
          new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime()
      )

      let ranking_trend = 'stable'
      let ranking_trend_value = 0

      if (sortedRanking.length >= 2) {
        const oldestRank = sortedRanking[0].national_ranking
        const newestRank = sortedRanking[sortedRanking.length - 1].national_ranking
        // Negative value = improved (number went down), positive = worsened
        ranking_trend_value = newestRank - oldestRank
        if (ranking_trend_value <= -2) ranking_trend = 'rising'
        else if (ranking_trend_value >= 2) ranking_trend = 'falling'
      }

      return {
        ...recruit,
        utr_trend,
        utr_trend_value,
        utr_history: sortedUtr,
        ranking_trend,
        ranking_trend_value,
        ranking_history: sortedRanking,
      }
    })

    // Identify undervalued players
    const undervalued = recruitsWithTrends.filter(r => {
      const rankingMin = profile?.target_ranking_min || 1
      const rankingMax = profile?.target_ranking_max || 200
      const inRange = r.national_ranking >= rankingMin && r.national_ranking <= rankingMax
      const isRising = r.utr_trend === 'rising'
      const notHighPriority = r.priority !== 'High'
      const highFit = r.fit_score >= 70
      return inRange && (isRising || highFit) && notHighPriority
    })

    // Rising stars — UTR trending up significantly
    const risingStars = recruitsWithTrends.filter(r => r.utr_trend_value >= 0.5)

    // Undercontacted high fit players
    const undercontacted = recruitsWithTrends.filter(r => {
      if (!r.last_contacted) return r.fit_score >= 70
      const days = Math.floor(
        (new Date().getTime() - new Date(r.last_contacted).getTime()) / (1000 * 60 * 60 * 24)
      )
      return days > 14 && r.fit_score >= 70
    })

    // Rising rankings — rank number improved by 2+ places
    const risingRankings = recruitsWithTrends.filter(r => r.ranking_trend === 'rising')

    return NextResponse.json({
      success: true,
      data: {
        all: recruitsWithTrends,
        undervalued,
        risingStars,
        undercontacted,
        risingRankings,
        notInPipeline: prospects || [],
      }
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
