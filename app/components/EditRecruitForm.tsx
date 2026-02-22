'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Recruit {
  id: string
  name: string
  class_year: number
  nationality: string
  location: string
  national_ranking: number
  plays: string
  priority: string
  fit_score: number
  utr_rating: number | null
  competing_schools: string[]
  notes: string
}

interface Props {
  recruit: Recruit
}

export default function EditRecruitForm({ recruit }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: recruit.name || '',
    class_year: String(recruit.class_year || ''),
    nationality: recruit.nationality || '',
    location: recruit.location || '',
    national_ranking: String(recruit.national_ranking || ''),
    plays: recruit.plays || 'RHP',
    priority: recruit.priority || 'Watch',
    fit_score: String(recruit.fit_score || '50'),
    utr_rating: String(recruit.utr_rating || ''),
    competing_schools: recruit.competing_schools?.join(', ') || '',
    notes: recruit.notes || '',
  })

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/recruits/${recruit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          class_year: parseInt(form.class_year) || null,
          national_ranking: parseInt(form.national_ranking) || null,
          fit_score: parseInt(form.fit_score) || 50,
          utr_rating: parseFloat(form.utr_rating) || null,
          competing_schools: form.competing_schools
            ? form.competing_schools.split(',').map(s => s.trim())
            : [],
        }),
      })

      if (!res.ok) throw new Error('Failed to save')

      setOpen(false)
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors'
  const selectClass = 'w-full bg-[#0f2040] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 hover:text-white transition-colors px-3 py-1.5 border border-white/10 hover:border-white/20 rounded-lg"
      >
        Edit Details
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f2040] border border-white/15 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* HEADER */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0f2040]">
              <div>
                <h2 className="font-semibold text-white">Edit Recruit</h2>
                <p className="text-xs text-slate-400 mt-0.5">{recruit.name}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-white transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* BODY */}
            <div className="px-6 py-5 flex flex-col gap-4">

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Class Year</label>
                  <select
                    value={form.class_year}
                    onChange={e => setForm(f => ({ ...f, class_year: e.target.value }))}
                    className={selectClass}
                  >
                    {['2026', '2027', '2028', '2029'].map(y => (
                      <option key={y} value={y} className="bg-[#0f2040]">{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Plays</label>
                  <select
                    value={form.plays}
                    onChange={e => setForm(f => ({ ...f, plays: e.target.value }))}
                    className={selectClass}
                  >
                    {['RHP', 'LHP', 'Both'].map(p => (
                      <option key={p} value={p} className="bg-[#0f2040]">{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Nationality</label>
                  <input
                    type="text"
                    value={form.nationality}
                    onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">National Ranking</label>
                  <input
                    type="number"
                    value={form.national_ranking}
                    onChange={e => setForm(f => ({ ...f, national_ranking: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">UTR Rating</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.utr_rating}
                    onChange={e => setForm(f => ({ ...f, utr_rating: e.target.value }))}
                    placeholder="e.g. 13.50"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Fit Score (0-100)</label>
                  <input
                    type="number"
                    value={form.fit_score}
                    onChange={e => setForm(f => ({ ...f, fit_score: e.target.value }))}
                    min="0"
                    max="100"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className={selectClass}
                  >
                    {['High', 'Medium', 'Watch'].map(p => (
                      <option key={p} value={p} className="bg-[#0f2040]">{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Competing Schools</label>
                <input
                  type="text"
                  value={form.competing_schools}
                  onChange={e => setForm(f => ({ ...f, competing_schools: e.target.value }))}
                  placeholder="Princeton, Yale, Penn (comma separated)"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Scouting Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>

            {/* FOOTER */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 sticky bottom-0 bg-[#0f2040]">
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}