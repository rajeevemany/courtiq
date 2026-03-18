import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  recruitRanking: number | null
}

interface ComparablePlayer {
  name: string
  peak_ranking: number
  career_singles_wins: number | null
  career_singles_losses: number | null
  career_summary: string | null
  honors: { national: string[]; regional: string[]; conference: string[]; team: string[] } | null
  peak_ita_ranking: number | null
}

function firstSentence(text: string | null, max = 100): string | null {
  if (!text) return null
  const sentence = text.split(/\.\s/)[0].trim()
  return sentence.length > max ? sentence.slice(0, max).trimEnd() + '…' : sentence
}

function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(' ')
  if (parts.length < 2) return fullName
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

export default async function ComparablePlayersCard({ recruitRanking }: Props) {
  if (!recruitRanking) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-slate-400 text-sm">◷</span>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
            Comparable Columbia Outcomes
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">Players recruited at a similar ranking</p>
        <p className="text-sm text-slate-500">No ranking data — add a national ranking to see comparables.</p>
      </div>
    )
  }

  const lo = recruitRanking - 15
  const hi = recruitRanking + 15

  const { data: juniors } = await supabase
    .from('junior_profiles')
    .select('id, name, peak_ranking, ranking_yr1, committed_year')
    .not('peak_ranking', 'is', null)
    .gte('peak_ranking', lo)
    .lte('peak_ranking', hi)
    .eq('committed_school', 'Columbia')

  if (!juniors || juniors.length === 0) {
    return <EmptyCard />
  }

  const ids = juniors.map(j => j.id)

  const { data: careers } = await supabase
    .from('college_careers')
    .select('junior_profile_id, career_singles_wins, career_singles_losses, career_summary, honors, peak_ita_ranking, school')
    .in('junior_profile_id', ids)
    .eq('school', 'Columbia')

  if (!careers || careers.length === 0) {
    return <EmptyCard />
  }

  const careerMap = new Map(careers.map(c => [c.junior_profile_id, c]))

  const comparables: ComparablePlayer[] = juniors
    .filter(j => careerMap.has(j.id))
    .map(j => {
      const c = careerMap.get(j.id)!
      return {
        name: j.name,
        peak_ranking: j.peak_ranking,
        career_singles_wins: c.career_singles_wins,
        career_singles_losses: c.career_singles_losses,
        career_summary: c.career_summary,
        honors: c.honors,
        peak_ita_ranking: c.peak_ita_ranking,
      }
    })
    .sort((a, b) => Math.abs(a.peak_ranking - recruitRanking) - Math.abs(b.peak_ranking - recruitRanking))
    .slice(0, 3)

  if (comparables.length === 0) {
    return <EmptyCard />
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-slate-400 text-sm">◷</span>
        <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
          Comparable Columbia Outcomes
        </h2>
      </div>
      <p className="text-xs text-slate-500 mb-5">Players recruited at a similar ranking</p>

      <div className="flex flex-col gap-4">
        {comparables.map((player, i) => {
          const hasStats = player.career_singles_wins !== null
          const topHonor = player.honors?.national?.[0] ?? null
          const summary = firstSentence(player.career_summary)

          return (
            <div key={i} className="flex flex-col gap-1.5 pb-4 border-b border-white/5 last:border-0 last:pb-0">
              {/* Name + rank */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">
                  {abbreviateName(player.name)}
                </span>
                <span className="font-mono text-xs font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded">
                  #{player.peak_ranking}
                </span>
                {topHonor && (
                  <span className="text-xs font-medium text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full truncate max-w-[140px]">
                    ★ {topHonor}
                  </span>
                )}
              </div>

              {/* Career record */}
              {hasStats ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-green-400">
                    {player.career_singles_wins}W
                  </span>
                  <span className="text-slate-500 text-sm">–</span>
                  <span className="text-sm font-semibold text-red-400">
                    {player.career_singles_losses}L
                  </span>
                  {player.peak_ita_ranking && (
                    <span className="text-xs text-slate-500 ml-1">
                      · Peak ITA #{player.peak_ita_ranking}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Stats pending</p>
              )}

              {/* Career summary */}
              {summary && (
                <p className="text-xs text-slate-400 leading-relaxed">{summary}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyCard() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-slate-400 text-sm">◷</span>
        <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
          Comparable Columbia Outcomes
        </h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">Players recruited at a similar ranking</p>
      <p className="text-sm text-slate-500">
        No comparable Columbia data yet — check back as more career records are added.
      </p>
    </div>
  )
}
