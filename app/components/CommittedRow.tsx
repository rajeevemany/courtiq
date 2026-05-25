'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Commitment {
  school: string
  conference: string | null
}

interface Recruit {
  id: string
  name: string
  class_year: string | number | null
  plays: string | null
  location: string | null
  priority: string
  national_ranking: number | null
  fit_score: number | null
  last_contacted: string | null
  recruit_stage: string | null
}

interface Props {
  recruit: Recruit
  commitment: Commitment
}

function daysSince(d: string | null) {
  if (!d) return 999
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

function getContactColor(days: number) {
  if (days <= 10) return 'text-green-400'
  if (days <= 21) return 'text-orange-400'
  return 'text-red-400'
}

function getStageColor(stage: string) {
  const map: Record<string, string> = {
    Identification: 'text-slate-400',
    Evaluation: 'text-blue-400',
    Contact: 'text-yellow-400',
    Offer: 'text-orange-400',
    Committed: 'text-green-400',
  }
  return map[stage] ?? 'text-slate-400'
}

export default function CommittedRow({ recruit, commitment }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    await fetch(`/api/recruits?id=${recruit.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const initials = recruit.name.split(' ').map(n => n[0]).join('')
  const days = daysSince(recruit.last_contacted)

  return (
    <div className="grid grid-cols-[1fr_80px_90px_100px_120px_80px_auto] gap-4 px-6 py-4 border-b border-white/5 border-l-4 border-l-rose-500/40 bg-rose-500/5 items-center">

      {/* NAME */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-rose-900/40 border border-rose-500/30 flex items-center justify-center text-xs font-bold text-rose-300 flex-shrink-0">
          {initials}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/recruits/${recruit.id}`}
              className="font-medium text-sm hover:text-white transition-colors"
            >
              {recruit.name}
            </Link>
            <span className="text-xs bg-rose-500/15 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
              Committed → {commitment.school}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {recruit.class_year} · {recruit.plays} · {recruit.location}
          </p>
        </div>
      </div>

      {/* RANKING */}
      <div className={`font-mono text-sm font-semibold ${recruit.national_ranking && recruit.national_ranking <= 50 ? 'text-yellow-400' : 'text-slate-300'}`}>
        {recruit.national_ranking ? `#${recruit.national_ranking}` : '—'}
      </div>

      {/* STAGE */}
      <div>
        <span className={`text-xs font-semibold ${getStageColor(recruit.recruit_stage ?? 'Identification')}`}>
          {recruit.recruit_stage ?? 'ID'}
        </span>
      </div>

      {/* PRIORITY */}
      <div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
          recruit.priority === 'High'   ? 'bg-red-500/15 text-red-400 border-red-500/30' :
          recruit.priority === 'Medium' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
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
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${recruit.fit_score ?? 0}%` }} />
        </div>
        <span className="text-xs font-mono text-slate-400">{recruit.fit_score}</span>
      </div>

      {/* REMOVE */}
      <div className="flex items-center justify-end">
        {confirming ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-rose-400 font-medium">Remove?</span>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-rose-400 hover:text-rose-300 font-semibold disabled:opacity-50 transition-colors"
            >
              {removing ? '…' : 'Yes'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-slate-500 hover:text-rose-400 transition-colors px-2 py-1 whitespace-nowrap"
            title="Remove from pipeline"
          >
            ✕ Remove
          </button>
        )}
      </div>
    </div>
  )
}
