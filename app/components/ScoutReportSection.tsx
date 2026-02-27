'use client'

import { useState } from 'react'

interface Props {
  recruitId: string
  recruitName: string
}

type CopyKey = 'text' | 'email' | 'dm'

export default function ScoutReportSection({ recruitId, recruitName }: Props) {
  const [loading, setLoading] = useState(false)
  const [scoutingNote, setScoutingNote] = useState('')
  const [outreachMessage, setOutreachMessage] = useState('')
  const [copied, setCopied] = useState<CopyKey | null>(null)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/scout-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruit_id: recruitId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to generate')
      setScoutingNote(data.scouting_note)
      setOutreachMessage(data.outreach_message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate scout report')
    } finally {
      setLoading(false)
    }
  }

  async function copyAs(key: CopyKey) {
    let text = outreachMessage
    if (key === 'email') {
      text = `Subject: Columbia Men's Tennis — ${recruitName}\n\n${outreachMessage}`
    }
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const copyButtons: { label: string; key: CopyKey }[] = [
    { label: 'Copy as Text', key: 'text' },
    { label: 'Copy as Email', key: 'email' },
    { label: 'Copy as DM',   key: 'dm'    },
  ]

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
          Scout Report &amp; Outreach
        </h2>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 bg-purple-600/15 hover:bg-purple-600/25 text-purple-400 border border-purple-500/30 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin w-3 h-3 border border-purple-400/30 border-t-purple-400 rounded-full" />
              Generating...
            </>
          ) : '✦ Generate Scout Report'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {scoutingNote ? (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Scouting Report
          </p>
          <div className="bg-white/3 border border-white/8 rounded-xl p-4">
            <p className="text-sm text-slate-300 leading-relaxed">{scoutingNote}</p>
          </div>
        </div>
      ) : null}

      {outreachMessage ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Outreach Message
          </p>
          <div className="bg-purple-950/25 border border-purple-500/20 rounded-xl p-4 mb-3">
            <p className="text-sm text-slate-200 leading-relaxed">{outreachMessage}</p>
          </div>
          <div className="flex items-center gap-2">
            {copyButtons.map(({ label, key }) => (
              <button
                key={key}
                onClick={() => copyAs(key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  copied === key
                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20 hover:text-white'
                }`}
              >
                {copied === key ? '✓ Copied' : label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!scoutingNote && !outreachMessage && !loading && (
        <div className="text-center py-10 text-slate-500">
          <p className="text-sm">No scout report generated yet</p>
          <p className="text-xs mt-1">
            Uses recent match results + recruit data to generate<br />
            personalized analysis and a first-contact outreach message
          </p>
        </div>
      )}
    </div>
  )
}
