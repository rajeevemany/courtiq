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

    // 3. Build last-name → candidates map for JS-side matching
    const jpsByLastName = new Map<string, JuniorProfile[]>()
    for (const jp of (juniors || []) as JuniorProfile[]) {
      const lastName = jp.name.split(' ').pop()?.toLowerCase() ?? ''
      if (!lastName) continue
      if (!jpsByLastName.has(lastName)) jpsByLastName.set(lastName, [])
      jpsByLastName.get(lastName)!.push(jp)
    }

    // 4. Unique seasons ordered newest first
    const seasonSet = new Set<string>()
    for (const row of (itaRows || [])) seasonSet.add(row.season)
    const seasons = Array.from(seasonSet).sort((a, b) => b.localeCompare(a))

    // 5. Match each ITA player to a junior profile
    const players = (itaRows || []).map(row => {
      const parts = row.player_name.trim().split(/\s+/)
      const lastName = parts[parts.length - 1].toLowerCase()
      const firstInitial = parts[0]?.[0]?.toLowerCase() ?? ''

      let matched: JuniorProfile | null = null
      const candidates = jpsByLastName.get(lastName) ?? []

      if (candidates.length === 1) {
        matched = candidates[0]
      } else if (candidates.length > 1) {
        // Prefer candidate whose first name starts with the same initial
        matched = candidates.find(jp =>
          jp.name.split(' ')[0]?.[0]?.toLowerCase() === firstInitial
        ) ?? candidates[0]
      }

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
