import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data: careers, error: err1 } = await supabase
      .from('college_careers')
      .select('junior_profile_id, peak_ita_ranking, career_singles_wins, career_singles_losses, school, honors, career_summary')
      .not('peak_ita_ranking', 'is', null)
      .lte('peak_ita_ranking', 100)
      .not('career_singles_wins', 'is', null)
      .order('peak_ita_ranking', { ascending: true })

    if (err1) throw err1

    const profileIds = (careers || []).map(c => c.junior_profile_id).filter(Boolean)

    const { data: profiles, error: err2 } = await supabase
      .from('junior_profiles')
      .select('id, name, committed_school, peak_ranking, ranking_yr2, ranking_yr3, ranking_yr4')
      .in('id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000'])

    if (err2) throw err2

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    const result = (careers || [])
      .map(c => {
        const jp = profileMap.get(c.junior_profile_id)
        if (!jp) return null
        return {
          name: jp.name,
          school: jp.committed_school,
          peak_tr_ranking: jp.peak_ranking,
          soph_rank: jp.ranking_yr2,
          junior_rank: jp.ranking_yr3,
          senior_rank: jp.ranking_yr4,
          ita_rank: c.peak_ita_ranking,
          wins: c.career_singles_wins,
          losses: c.career_singles_losses,
          college: c.school,
          honors: c.honors,
          career_summary: c.career_summary,
        }
      })
      .filter(Boolean)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[ita-pipeline]', error)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}
