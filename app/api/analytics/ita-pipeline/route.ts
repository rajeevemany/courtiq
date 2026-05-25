import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface JuniorProfile {
  id: string
  name: string
  peak_ranking: number | null
  ranking_yr2: number | null
  ranking_yr3: number | null
  ranking_yr4: number | null
  committed_school: string | null
}

export async function GET() {
  try {
    // 1. All men's singles ITA rankings, newest season first
    const { data: itaRows, error: err1 } = await supabase
      .from('ita_rankings')
      .select('player_name, school, ita_rank, season')
      .eq('match_format', 'SINGLES')
      .eq('gender', 'M')
      .order('season', { ascending: false })
      .order('ita_rank', { ascending: true })

    if (err1) throw err1

    // 2. All junior profiles in one fetch
    const { data: juniors, error: err2 } = await supabase
      .from('junior_profiles')
      .select('id, name, peak_ranking, ranking_yr2, ranking_yr3, ranking_yr4, committed_school')

    if (err2) throw err2

    // 3. Build last-name → candidates map (jp.name format is "M. Zheng")
    const jpMap = new Map<string, JuniorProfile[]>()
    for (const jp of (juniors || []) as JuniorProfile[]) {
      const lastName = jp.name.split(' ').pop()?.toLowerCase() ?? ''
      if (!lastName) continue
      if (!jpMap.has(lastName)) jpMap.set(lastName, [])
      jpMap.get(lastName)!.push(jp)
    }

    // 4. Unique seasons ordered newest first
    const seasonSet = new Set<string>()
    for (const row of (itaRows || [])) seasonSet.add(row.season)
    const seasons = Array.from(seasonSet).sort((a, b) => b.localeCompare(a))

    // 5. Match each ITA player to a junior profile
    //    ITA names are "Michael Zheng"; jp names are "M. Zheng"
    //    Match on last name + first initial (jp.name[0] === ITA first name[0])
    const players = (itaRows || []).map(row => {
      const parts = row.player_name.trim().split(/\s+/)
      const lastName  = parts[parts.length - 1].toLowerCase()
      const firstName = parts[0] ?? ''

      const candidates = jpMap.get(lastName) ?? []
      const matched = candidates.find(jp =>
        jp.name[0]?.toLowerCase() === firstName[0]?.toLowerCase()
      ) ?? (candidates.length === 1 ? candidates[0] : null)

      return {
        ita_rank:        row.ita_rank,
        season:          row.season,
        player_name:     row.player_name,
        school:          row.school ?? null,
        tr_peak_ranking: matched?.peak_ranking ?? null,
        soph_rank:       matched?.ranking_yr2 ?? null,
        junior_rank:     matched?.ranking_yr3 ?? null,
        senior_rank:     matched?.ranking_yr4 ?? null,
        committed_school: matched?.committed_school ?? null,
        itf_ranking:     null,
        matched:         matched !== null,
      }
    })

    return NextResponse.json({ seasons, players })
  } catch (error) {
    console.error('[ita-pipeline]', error)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}
