'use client'

import { useState } from 'react'

interface Props {
  recruitId: string
  initialNotes: string | null
}

export default function CoachNotesEditor({ recruitId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    setSaving(true)
    try {
      await fetch(`/api/recruits/${recruitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
          📋 Coach Notes
        </h2>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-slate-500">Saving...</span>}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <textarea
          className="w-full bg-transparent border border-white/20 rounded-xl p-3 text-slate-300 text-sm leading-relaxed resize-none focus:outline-none focus:border-blue-500/40 min-h-[100px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          placeholder="Add coach notes..."
        />
      ) : notes ? (
        <p className="text-slate-300 leading-relaxed">{notes}</p>
      ) : (
        <p className="text-sm text-slate-500 italic">No notes added yet.</p>
      )}
    </div>
  )
}
