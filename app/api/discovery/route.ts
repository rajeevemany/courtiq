import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Get all recruits with UTR history
    const { data: recruits, error } = await supabase
      .from('recruits')
      .select(`
        *,
        utr_history (
          utr_rating,
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

    // Calculate UTR trend for each recruit
    const recruitsWithTrends = (recruits || []).map(recruit => {
      const history = recruit.utr_history || []
      const sorted = [...history].sort(
        (a: { recorded_date: string }, b: { recorded_date: string }) =>
          new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime()
      )

      let trend = 'stable'
      let trendValue = 0

      if (sorted.length >= 2) {
        const oldest = sorted[0].utr_rating
        const newest = sorted[sorted.length - 1].utr_rating
        trendValue = Math.round((newest - oldest) * 100) / 100
        if (trendValue >= 0.5) trend = 'rising'
        else if (trendValue <= -0.5) trend = 'falling'
      }

      return {
        ...recruit,
        utr_trend: trend,
        utr_trend_value: trendValue,
        utr_history: sorted,
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

    // Rising stars — trending up significantly
    const risingStars = recruitsWithTrends.filter(r => r.utr_trend_value >= 0.5)

    // Undercontacted high fit players
    const undercontacted = recruitsWithTrends.filter(r => {
      if (!r.last_contacted) return r.fit_score >= 70
      const days = Math.floor(
        (new Date().getTime() - new Date(r.last_contacted).getTime()) / (1000 * 60 * 60 * 24)
      )
      return days > 14 && r.fit_score >= 70
    })

    return NextResponse.json({
      success: true,
      data: {
        all: recruitsWithTrends,
        undervalued,
        risingStars,
        undercontacted,
      }
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}