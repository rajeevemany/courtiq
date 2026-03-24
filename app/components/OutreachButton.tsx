'use client'

import { useState } from 'react'

interface Props {
  recruitId: string
  recruitStage: string | null
}

export default function OutreachButton({ recruitId, recruitStage }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null)
  const [editableSubject, setEditableSubject] = useState('')
  const [editableBody, setEditableBody] = useState('')
  const [copied, setCopied] = useState(false)

  async function generateDraft() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/recruits/${recruitId}/outreach`, { method: 'POST' })
      const data = await res.json()

      if (!data.success) throw new Error(data.error)

      setDraft({ subject: data.subject, body: data.body })
      setEditableSubject(data.subject)
      setEditableBody(data.body)
    } catch (err) {
      console.error(err)
      setError('Failed to generate email draft.')
    } finally {
      setLoading(false)
    }
  }

  function closeModal() {
    setDraft(null)
    setError(null)
    setCopied(false)
  }

  async function copyToClipboard() {
    const text = `Subject: ${editableSubject}\n\n${editableBody}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const stageLabel = recruitStage ?? 'Identification'

  return (
    <>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Envelope icon */}
            <svg
              className="w-4 h-4 text-emerald-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25m19.5 0-9.75 6.75L2.25 6.75"
              />
            </svg>
            <h2 className="font-semibold text-sm uppercase tracking-wider text-emerald-400">
              Outreach
            </h2>
          </div>
          <button
            onClick={generateDraft}
            disabled={loading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {loading ? 'Drafting...' : 'Draft Email'}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!error && !loading && (
          <p className="text-sm text-slate-400">
            Generate a stage-appropriate email draft for this recruit.{' '}
            <span className="text-slate-500">Stage: {stageLabel}</span>
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-2">
            <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Writing email draft...</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-[#0f1f3a] border border-white/15 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25m19.5 0-9.75 6.75L2.25 6.75"
                  />
                </svg>
                <span className="font-semibold text-sm text-white">Email Draft</span>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-500 hover:text-white transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={editableSubject}
                  onChange={(e) => setEditableSubject(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Body
                </label>
                <textarea
                  value={editableBody}
                  onChange={(e) => setEditableBody(e.target.value)}
                  rows={10}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button
                onClick={closeModal}
                className="text-sm font-medium px-4 py-2 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={copyToClipboard}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
              >
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
