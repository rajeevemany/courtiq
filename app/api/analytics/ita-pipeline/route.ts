import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const revalidate = 0
export const dynamic = 'force-dynamic'

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
  tennisrecruiting_id: string | null
}

interface ITFEntry {
  ranking: number
  nationality: string
  firstInitial: string
}

async function fetchAllJuniorProfiles(client: SupabaseClient) {
  const allProfiles: JuniorProfile[] = []
  const batchSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await client
      .from('junior_profiles')
      .select('id, name, peak_ranking, ranking_yr2, ranking_yr3, ranking_yr4, committed_school, tennisrecruiting_id')
      .range(from, from + batchSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    allProfiles.push(...(data as JuniorProfile[]))
    if (data.length < batchSize) break
    from += batchSize
  }

  return allProfiles
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

    // 2. All junior profiles in batches to bypass PostgREST page limit
    const allJuniors = await fetchAllJuniorProfiles(supabase)

    // 3. ITF cache for cross-referencing unmatched international players
    const { data: itfPlayers } = await supabase
      .from('itf_players_cache')
      .select('name, ranking, nationality')

    // Build last-name → ITF entry map (itf names are full: "Michael Zheng")
    const itfMap = new Map<string, ITFEntry>()
    for (const p of (itfPlayers || [])) {
      const parts = (p.name as string).trim().split(/\s+/)
      const lastName = parts[parts.length - 1]?.toLowerCase()
      if (!lastName) continue
      if (!itfMap.has(lastName)) {
        itfMap.set(lastName, {
          ranking:      p.ranking,
          nationality:  p.nationality,
          firstInitial: parts[0]?.[0]?.toLowerCase() ?? '',
        })
      }
    }

    // 4. Build last-name → candidates map (jp.name format: "M. Zheng")
    const jpMap = new Map<string, JuniorProfile[]>()
    for (const jp of allJuniors) {
      const lastName = jp.name.split(' ').pop()?.toLowerCase() ?? ''
      if (!lastName) continue
      if (!jpMap.has(lastName)) jpMap.set(lastName, [])
      jpMap.get(lastName)!.push(jp)
    }

    // 5. Unique seasons ordered newest first
    const seasonSet = new Set<string>()
    for (const row of (itaRows || [])) seasonSet.add(row.season)
    const seasons = Array.from(seasonSet).sort((a, b) => b.localeCompare(a))

    // 6. Match each ITA player to a junior profile
    //    ITA names: "Michael Zheng" — jp names: "M. Zheng"
    //    Primary: last name + first initial; fallback: single candidate only
    const players = (itaRows || []).map(row => {
      const parts = row.player_name.trim().split(/\s+/)
      const lastName  = parts[parts.length - 1].toLowerCase()
      const firstName = parts[0] ?? ''

      const candidates = jpMap.get(lastName) ?? []
      const matched = candidates.find(jp =>
        jp.name[0]?.toLowerCase() === firstName[0]?.toLowerCase()
      ) ?? (candidates.length === 1 ? candidates[0] : null)

      // For unmatched players, try ITF cache (first initial + last name)
      let itf_ranking: number | null = null
      let nationality: string | null = null
      if (!matched) {
        const itfEntry = itfMap.get(lastName)
        if (itfEntry && (itfEntry.firstInitial === firstName[0]?.toLowerCase() || !itfEntry.firstInitial)) {
          itf_ranking = itfEntry.ranking
          nationality = itfEntry.nationality
        }
      }

      return {
        ita_rank:         row.ita_rank,
        season:           row.season,
        player_name:      row.player_name,
        school:           row.school ?? null,
        tr_peak_ranking:  matched?.peak_ranking ?? null,
        soph_rank:        matched?.ranking_yr2 ?? null,
        junior_rank:      matched?.ranking_yr3 ?? null,
        senior_rank:      matched?.ranking_yr4 ?? null,
        committed_school: matched?.committed_school ?? null,
        itf_ranking,
        nationality,
        matched:          matched !== null,
      }
    })

    return NextResponse.json({ seasons, players })
  } catch (error) {
    console.error('[ita-pipeline]', error)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}
