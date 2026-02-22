'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddRecruitForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    class_year: '2027',
    nationality: 'USA',
    location: '',
    national_ranking: '',
    plays: 'RHP',
    priority: 'Watch',
    notes: '',
    competing_schools: '',
    fit_score: '50',
    utr_rating: '',
  })

  async function handleSubmit() {
    if (!form.name.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/recruits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
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
      setForm({
        name: '',
        class_year: '2027',
        nationality: 'USA',
        location: '',
        national_ranking: '',
        plays: 'RHP',
        priority: 'Watch',
        notes: '',
        competing_schools: '',
        fit_score: '50',
        utr_rating: '',
      })
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + Add Recruit
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f2040] border border-white/15 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* HEADER */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0f2040]">
              <div>
                <h2 className="font-semibold text-white">Add New Recruit</h2>
                <p className="text-xs text-slate-400 mt-0.5">Columbia Men's Tennis</p>
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

              {/* NAME */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="First Last"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* CLASS YEAR + PLAYS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Class Year
                  </label>
                  <select
                    value={form.class_year}
                    onChange={e => setForm(f => ({ ...f, class_year: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {['2026', '2027', '2028', '2029'].map(y => (
                      <option key={y} value={y} className="bg-[#0f2040]">{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Plays
                  </label>
                  <select
                    value={form.plays}
                    onChange={e => setForm(f => ({ ...f, plays: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {['RHP', 'LHP', 'Both'].map(p => (
                      <option key={p} value={p} className="bg-[#0f2040]">{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* NATIONALITY + LOCATION */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={form.nationality}
                    onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}
                    placeholder="USA"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="City, State"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* RANKING + FIT SCORE */}
              <div className="grid grid-cols-2 gap-3">
                {/* UTR */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  UTR Rating
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.utr_rating}
                  onChange={e => setForm(f => ({ ...f, utr_rating: e.target.value }))}
                  placeholder="e.g. 13.50"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    National Ranking
                  </label>
                  <input
                    type="number"
                    value={form.national_ranking}
                    onChange={e => setForm(f => ({ ...f, national_ranking: e.target.value }))}
                    placeholder="e.g. 47"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Fit Score (0-100)
                  </label>
                  <input
                    type="number"
                    value={form.fit_score}
                    onChange={e => setForm(f => ({ ...f, fit_score: e.target.value }))}
                    min="0"
                    max="100"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* PRIORITY */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['High', 'Medium', 'Watch'].map(p => (
                    <button
                      key={p}
                      onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`py-2 rounded-lg text-xs font-semibold transition-colors border ${
                        form.priority === p
                          ? p === 'High'
                            ? 'bg-red-500/20 border-red-500/50 text-red-400'
                            : p === 'Medium'
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* COMPETING SCHOOLS */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Competing Schools
                </label>
                <input
                  type="text"
                  value={form.competing_schools}
                  onChange={e => setForm(f => ({ ...f, competing_schools: e.target.value }))}
                  placeholder="Princeton, Yale, Penn (comma separated)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* NOTES */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Initial Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="First impressions, playing style, how you found them..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
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
                onClick={handleSubmit}
                disabled={loading || !form.name.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Saving...' : 'Add Recruit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}