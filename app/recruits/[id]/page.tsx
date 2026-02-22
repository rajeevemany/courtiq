import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import LogContactForm from '@/app/components/LogContactForm'
import DeleteRecruitButton from '@/app/components/DeleteRecruitButton'
import AIBriefButton from '@/app/components/AIBriefButton'
import DocumentUpload from '@/app/components/DocumentUpload'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function daysSince(dateString: string | null): number {
  if (!dateString) return 999
  const last = new Date(dateString)
  const now = new Date()
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function RecruitProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: recruit, error } = await supabase
    .from('recruits')
    .select('*')
    .eq('id', id)
    .single()

  const { data: interactions } = await supabase
    .from('interactions')
    .select('*')
    .eq('recruit_id', id)
    .order('date', { ascending: false })

  if (error || !recruit) {
    return (
      <div className="min-h-screen bg-[#0a1628] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">Recruit not found</p>
          <Link href="/" className="text-blue-400 underline">Back to dashboard</Link>
        </div>
      </div>
    )
  }

  const days = daysSince(recruit.last_contacted)

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">

      {/* HEADER */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors text-sm">
            ← Dashboard
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-sm text-slate-300">{recruit.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
            recruit.priority === 'High' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
            recruit.priority === 'Medium' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
            'bg-blue-500/15 text-blue-400 border-blue-500/30'
          }`}>
            {recruit.priority} Priority
          </span>
          <DeleteRecruitButton recruitId={recruit.id} recruitName={recruit.name} />
          <LogContactForm recruitId={recruit.id} recruitName={recruit.name} />
        </div>
      </div>

      <div className="px-8 py-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-[1fr_380px] gap-6">

          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-5">

            {/* RECRUIT HERO */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 rounded-2xl bg-blue-900/50 border border-blue-500/30 flex items-center justify-center text-xl font-bold text-blue-300 flex-shrink-0">
                  {recruit.name.split(' ').map((n: string) => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-semibold tracking-tight">{recruit.name}</h1>
                  <p className="text-slate-400 mt-1">
                    Class of {recruit.class_year} · {recruit.plays} · {recruit.location}
                  </p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-yellow-400 font-mono font-semibold">
                      #{recruit.national_ranking} National
                    </span>
                    <span className="text-white/20">·</span>
                    <span className="text-slate-300">{recruit.nationality}</span>
                    <span className="text-white/20">·</span>
                    <span className={`font-medium text-sm ${
                      days > 21 ? 'text-red-400' :
                      days > 10 ? 'text-orange-400' :
                      'text-green-400'
                    }`}>
                      {days === 999 ? 'Never contacted' : `Last contact ${days}d ago`}
                      {days > 21 && ' ⚠'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Program Fit</p>
                  <p className="text-4xl font-semibold text-blue-400">{recruit.fit_score}</p>
                </div>
              </div>
            </div>

            {/* NOTES */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-400">
                Scouting Notes
              </h2>
              <p className="text-slate-300 leading-relaxed">
                {recruit.notes || 'No notes added yet.'}
              </p>
            </div>

            {/* INTERACTION HISTORY */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
                  Interaction History
                </h2>
                <span className="text-xs text-slate-500">
                  {interactions?.length || 0} logged
                </span>
              </div>

              {interactions && interactions.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {interactions.map((interaction) => (
                    <div
                      key={interaction.id}
                      className="flex gap-4 p-4 bg-white/3 border border-white/5 rounded-xl"
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        interaction.type === 'call' ? 'bg-green-400' :
                        interaction.type === 'email' ? 'bg-blue-400' :
                        interaction.type === 'visit' ? 'bg-yellow-400' :
                        'bg-slate-400'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {interaction.type}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(interaction.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{interaction.notes}</p>
                        {interaction.author && (
                          <p className="text-xs text-slate-500 mt-1">— {interaction.author}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">No interactions logged yet</p>
                  <p className="text-xs mt-1">Use the Log Contact button to add the first one</p>
                </div>
              )}
            </div>

            {/* DOCUMENTS */}
            <DocumentUpload recruitId={recruit.id} />

          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-5">

            {/* QUICK STATS */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-400">
                Quick Info
              </h2>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Class Year', value: recruit.class_year },
                  { label: 'Plays', value: recruit.plays },
                  { label: 'Nationality', value: recruit.nationality },
                  { label: 'Location', value: recruit.location },
                  { label: 'National Ranking', value: `#${recruit.national_ranking}` },
                  { label: 'Status', value: recruit.status },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                  >
                    <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
                    <span className="text-sm text-slate-200 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* COMPETING SCHOOLS */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-400">
                Competing Schools
              </h2>
              {recruit.competing_schools && recruit.competing_schools.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {recruit.competing_schools.map((school: string) => (
                    <span
                      key={school}
                      className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-slate-300"
                    >
                      {school}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No competing schools logged</p>
              )}
            </div>

            {/* AI BRIEF */}
            <AIBriefButton
              recruitId={recruit.id}
              existingBrief={recruit.ai_brief}
              existingBriefDate={recruit.ai_brief_generated_at}
            />

          </div>
        </div>
      </div>
    </main>
  )
}