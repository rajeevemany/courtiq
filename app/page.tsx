import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import AddRecruitForm from '@/app/components/AddRecruitForm'
import SignOutButton from '@/app/components/SignOutButton'

export const revalidate = 0

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

function daysUntil(dateString: string | null): number {
  if (!dateString) return 999
  const target = new Date(dateString)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function getPriorityColor(priority: string): string {
  if (priority === 'High') return 'border-l-red-500'
  if (priority === 'Medium') return 'border-l-orange-400'
  return 'border-l-blue-400'
}

function getContactColor(days: number): string {
  if (days <= 10) return 'text-green-400'
  if (days <= 21) return 'text-orange-400'
  return 'text-red-400'
}

function getStageColor(stage: string): string {
  if (stage === 'Identification') return 'text-slate-400'
  if (stage === 'Evaluation') return 'text-blue-400'
  if (stage === 'Contact') return 'text-yellow-400'
  if (stage === 'Offer') return 'text-orange-400'
  if (stage === 'Committed') return 'text-green-400'
  return 'text-slate-400'
}

export default async function Home() {
  const { data: recruits, error } = await supabase
    .from('recruits')
    .select('*')
    .order('national_ranking', { ascending: true })

  if (error) {
    console.error(error)
    return <div className="p-8 text-red-500">Error loading recruits: {error.message}</div>
  }

  const priorityOrder: Record<string, number> = { High: 1, Medium: 2, Watch: 3 }
  const sorted = [...(recruits || [])].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  const highPriority = sorted.filter(r => r.priority === 'High')
  const needsAttention = sorted.filter(r => daysSince(r.last_contacted) > 21)
  const windowOpeningSoon = sorted.filter(r => {
    if (!r.first_contact_eligible) return false
    const days = daysUntil(r.first_contact_eligible)
    return days > 0 && days <= 30
  })
  const windowJustOpened = sorted.filter(r => {
    if (!r.first_contact_eligible) return false
    const days = daysUntil(r.first_contact_eligible)
    return days <= 0 && days >= -14
  })

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">

      {/* HEADER */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Columbia Men's Tennis</h1>
          <p className="text-sm text-slate-400 mt-0.5">Recruiting Dashboard · Head Coach View</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Class of 2026 &amp; 2027</span>
          <SignOutButton />
          <AddRecruitForm />
        </div>
      </div>

      <div className="px-8 py-6 max-w-7xl mx-auto">

        {/* CONTACT WINDOW ALERTS */}
        {windowJustOpened.length > 0 && (
          <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-green-400 text-lg">✓</span>
            <p className="text-green-300 text-sm font-medium">
              Contact window just opened for {windowJustOpened.length} recruit{windowJustOpened.length > 1 ? 's' : ''} — {windowJustOpened.map(r => r.name).join(', ')}
            </p>
          </div>
        )}

        {windowOpeningSoon.length > 0 && (
          <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-yellow-400 text-lg">⏰</span>
            <p className="text-yellow-300 text-sm font-medium">
              Contact window opening within 30 days for {windowOpeningSoon.length} recruit{windowOpeningSoon.length > 1 ? 's' : ''} — {windowOpeningSoon.map(r => r.name).join(', ')}
            </p>
          </div>
        )}

        {/* EXISTING ALERT BANNER */}
        {needsAttention.length > 0 && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠</span>
            <p className="text-red-300 text-sm font-medium">
              {needsAttention.length} recruit{needsAttention.length > 1 ? 's have' : ' has'} not been contacted in over 21 days
              — {needsAttention.map(r => r.name).join(', ')}
            </p>
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Recruits', value: sorted.length, sub: 'in pipeline' },
            {
              label: 'High Priority',
              value: highPriority.length,
              sub: `${needsAttention.filter(r => r.priority === 'High').length} need attention`,
              warn: true
            },
            {
              label: 'Avg Fit Score',
              value: sorted.length > 0
                ? Math.round(sorted.reduce((a, r) => a + (r.fit_score || 0), 0) / sorted.length) + '%'
                : '0%',
              sub: 'program match'
            },
            {
              label: 'Windows Opening',
              value: windowOpeningSoon.length + windowJustOpened.length,
              sub: 'contact eligible soon',
              alert: windowJustOpened.length > 0
            },
          ].map((stat, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                {stat.label}
              </p>
              <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
              <p className={`text-xs mt-1.5 font-medium ${
                stat.alert ? 'text-green-400' :
                stat.warn ? 'text-orange-400' :
                'text-green-400'
              }`}>
                {stat.sub}
              </p>
            </div>
          ))}
        </div>

        {/* RECRUIT TABLE */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Recruit Pipeline</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {sorted.length} recruits · sorted by priority
              </p>
            </div>
          </div>

          {/* TABLE HEADER */}
          <div className="grid grid-cols-[1fr_80px_90px_100px_120px_80px] gap-4 px-6 py-3 border-b border-white/5">
            {['Recruit', 'Ranking', 'Stage', 'Priority', 'Last Contact', 'Fit'].map(h => (
              <span
                key={h}
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                {h}
              </span>
            ))}
          </div>

          {sorted.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <p className="text-sm">No recruits yet</p>
              <p className="text-xs mt-1">Click + Add Recruit to get started</p>
            </div>
          )}

          {sorted.map((recruit) => {
            const days = daysSince(recruit.last_contacted)
            const initials = recruit.name
              .split(' ')
              .map((n: string) => n[0])
              .join('')
            const contactDays = recruit.first_contact_eligible
              ? daysUntil(recruit.first_contact_eligible)
              : null

            return (
              <Link
                href={`/recruits/${recruit.id}`}
                key={recruit.id}
                className={`grid grid-cols-[1fr_80px_90px_100px_120px_80px] gap-4 px-6 py-4 border-b border-white/5 border-l-4 ${getPriorityColor(recruit.priority)} hover:bg-white/5 transition-colors cursor-pointer items-center`}
              >
                {/* NAME */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-900/50 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300 flex-shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{recruit.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {recruit.class_year} · {recruit.plays} · {recruit.location}
                    </p>
                    {contactDays !== null && contactDays > 0 && contactDays <= 30 && (
                      <p className="text-xs text-yellow-400 mt-0.5">⏰ Contact eligible in {contactDays}d</p>
                    )}
                    {contactDays !== null && contactDays <= 0 && contactDays >= -14 && (
                      <p className="text-xs text-green-400 mt-0.5">✓ Contact window open</p>
                    )}
                  </div>
                </div>

                {/* RANKING */}
                <div className={`font-mono text-sm font-semibold ${
                  recruit.national_ranking <= 50 ? 'text-yellow-400' : 'text-slate-300'
                }`}>
                  {recruit.national_ranking ? `#${recruit.national_ranking}` : '—'}
                </div>

                {/* STAGE */}
                <div>
                  <span className={`text-xs font-semibold ${getStageColor(recruit.recruit_stage || 'Identification')}`}>
                    {recruit.recruit_stage || 'ID'}
                  </span>
                </div>

                {/* PRIORITY */}
                <div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    recruit.priority === 'High'
                      ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                    recruit.priority === 'Medium'
                      ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
                      'bg-blue-500/15 text-blue-400 border-blue-500/30'
                  }`}>
                    {recruit.priority}
                  </span>
                </div>

                {/* LAST CONTACT */}
                <div className={`text-sm font-medium ${getContactColor(days)}`}>
                  {days === 999 ? 'Never' : `${days}d ago`}
                  {days > 21 && <span className="ml-1">⚠</span>}
                </div>

                {/* FIT SCORE */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${recruit.fit_score}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {recruit.fit_score}
                  </span>
                </div>

              </Link>
            )
          })}
        </div>

        {/* NEEDS ATTENTION */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-blue-400">✦</span>
              <h2 className="font-semibold">Needs Your Attention</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Watch-list recruits you haven't contacted in 30+ days
            </p>
          </div>

          {(() => {
            const watchNeglected = sorted.filter(
              r => r.priority === 'Watch' && daysSince(r.last_contacted) > 30
            )

            if (watchNeglected.length === 0) {
              return (
                <div className="px-6 py-8 text-center text-slate-500">
                  <p className="text-sm">No neglected recruits — good work staying on top of your pipeline.</p>
                </div>
              )
            }

            return (
              <div className="divide-y divide-white/5">
                {watchNeglected.map(recruit => {
                  const days = daysSince(recruit.last_contacted)
                  const initials = recruit.name.split(' ').map((n: string) => n[0]).join('')
                  return (
                    <Link
                      key={recruit.id}
                      href={`/recruits/${recruit.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-900/50 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300 flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{recruit.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {recruit.class_year} · #{recruit.national_ranking} · {recruit.location}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-red-400 font-medium">{days}d since contact</p>
                        <p className="text-xs text-slate-500 mt-0.5">Fit {recruit.fit_score}%</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    </main>
  )
}