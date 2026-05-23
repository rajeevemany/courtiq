'use client'

import { useState } from 'react'

interface Props {
  recruitId: string
  recruitStage: string | null
}

type ContactType = 'initial' | 'followup'
type OutreachFormat = 'email' | 'text'

interface Draft {
  subject: string | null
  body: string
  format: OutreachFormat
}

export default function OutreachButton({ recruitId, recruitStage }: Props) {
  const [contactType, setContactType] = useState<ContactType>('initial')
  const [outreachFormat, setOutreachFormat] = useState<OutreachFormat>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    setError(null)
    setDraft(null)

    try {
      const res = await fetch(`/api/recruits/${recruitId}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruitId, recruitStage, contactType, outreachFormat }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setDraft({ subject: data.subject ?? null, body: data.body, format: outreachFormat })
    } catch (err) {
      console.error(err)
      setError('Failed to generate draft.')
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard() {
    const text = draft?.subject
      ? `Subject: ${draft.subject}\n\n${draft.body}`
      : (draft?.body ?? '')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const mailtoHref =
    draft?.format === 'email' && draft.subject
      ? `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
      : null

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25m19.5 0-9.75 6.75L2.25 6.75" />
        </svg>
        <h2 className="font-semibold text-sm uppercase tracking-wider text-emerald-400">
          📧 Outreach Email
        </h2>
      </div>
      <p className="text-xs text-slate-500 italic mb-5">
        Drafts a stage-appropriate message from Howard Endelman based on the recruit&apos;s current pipeline stage
      </p>

      {/* Controls */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Contact type */}
        <div className="flex rounded-lg overflow-hidden border border-white/10 w-fit">
          {(['initial', 'followup'] as ContactType[]).map((type) => (
            <button
              key={type}
              onClick={() => setContactType(type)}
              className={`text-xs font-medium px-4 py-2 transition-colors ${
                contactType === type
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {type === 'initial' ? 'Initial Contact' : 'Follow-Up'}
            </button>
          ))}
        </div>

        {/* Format */}
        <div className="flex rounded-lg overflow-hidden border border-white/10 w-fit">
          {(['email', 'text'] as OutreachFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setOutreachFormat(fmt)}
              className={`text-xs font-medium px-4 py-2 transition-colors ${
                outreachFormat === fmt
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {fmt === 'email' ? '📧 Formal Email' : '💬 Text/DM'}
            </button>
          ))}
        </div>
      </div>

      {/* Generate */}
      <button
        onClick={generate}
        disabled={loading}
        className="text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
      >
        {loading ? 'Generating...' : 'Generate Outreach'}
      </button>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 mt-4">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Writing draft...</p>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

      {/* Result */}
      {draft && !loading && (
        <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/10">
          {draft.format === 'email' && draft.subject && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Subject
              </label>
              <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 select-all">
                {draft.subject}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              {draft.format === 'email' ? 'Body' : 'Message'}
            </label>
            <textarea
              readOnly
              value={draft.body}
              rows={draft.format === 'email' ? 10 : 5}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 leading-relaxed resize-none focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
            {mailtoHref && (
              <a
                href={mailtoHref}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
              >
                Open in Mail
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
