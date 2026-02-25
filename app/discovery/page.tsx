'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Recruit {
  id: string
  name: string
  class_year: number
  national_ranking: number
  location: string
  nationality: string
  utr_rating: number | null
  utr_trend: string
  utr_trend_value: number
  ranking_trend: string
  ranking_trend_value: number
  fit_score: number
  priority: string
  last_contacted: string | null
  plays: string
  tennisrecruiting_id: string | null
  utr_history: { utr_rating: number, recorded_date: string }[]
  ranking_history: { national_ranking: number, recorded_date: string }[]
}

interface DiscoveryData {
  all: Recruit[]
  undervalued: Recruit[]
  risingStars: Recruit[]
  undercontacted: Recruit[]
  risingRankings: Recruit[]
}

function TrendBadge({ trend, value }: { trend: string, value: number }) {
  if (trend === 'rising') return (
    <span className="text-xs font-semibold text-green-400">
      ↑ +{value.toFixed(2)} UTR
    </span>
  )
  if (trend === 'falling') return (
    <span className="text-xs font-semibold text-red-400">
      ↓ {value.toFixed(2)} UTR
    </span>
  )
  return <span className="text-xs text-slate-500">→ Stable</span>
}

function RankingTrendBadge({ trend, value }: { trend: string, value: number }) {
  if (trend === 'rising') return (
    <span className="text-xs font-semibold text-emerald-400">
      ↑ #{Math.abs(value)} rank
    </span>
  )
  if (trend === 'falling') return (
    <span className="text-xs font-semibold text-red-400">
      ↓ #{Math.abs(value)} rank
    </span>
  )
  return null
}

function RecruitCard({ recruit }: { recruit: Recruit }) {
  const initials = recruit.name.split(' ').map(n => n[0]).join('')

  return (
    <Link
      href={`/recruits/${recruit.id}`}
      className="flex items-center gap-4 p-4 bg-white/3 border border-white/5 rounded-xl hover:bg-white/8 transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-blue-900/50 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300 flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-white">{recruit.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {recruit.class_year} · #{recruit.national_ranking} · {recruit.location}
        </p>
        <div className="flex items-center gap-3 mt-1">
          {recruit.utr_rating && (
            <span className="text-xs text-slate-400">UTR {recruit.utr_rating}</span>
          )}
          <TrendBadge trend={recruit.utr_trend} value={recruit.utr_trend_value} />
          <RankingTrendBadge trend={recruit.ranking_trend} value={recruit.ranking_trend_value} />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-blue-400">{recruit.fit_score}</p>
        <p className="text-xs text-slate-500">fit score</p>
      </div>
    </Link>
  )
}

export default function DiscoveryPage() {
  const [data, setData] = useState<DiscoveryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'undervalued' | 'rising' | 'risingRankings' | 'undercontacted' | 'all'>('undervalued')
  const [showAddUTR, setShowAddUTR] = useState(false)
  const [utrForm, setUtrForm] = useState({
    recruit_id: '',
    utr_rating: '',
    recorded_date: new Date().toISOString().split('T')[0],
  })
  const [savingUTR, setSavingUTR] = useState(false)

  useEffect(() => {
    fetchDiscovery()
  }, [])

  async function fetchDiscovery() {
    try {
      const res = await fetch('/api/discovery')
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddUTR() {
    setSavingUTR(true)
    try {
      const res = await fetch('/api/utr-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruit_id: utrForm.recruit_id,
          utr_rating: parseFloat(utrForm.utr_rating),
          recorded_date: utrForm.recorded_date,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setShowAddUTR(false)
        setUtrForm({
          recruit_id: '',
          utr_rating: '',
          recorded_date: new Date().toISOString().split('T')[0],
        })
        fetchDiscovery()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSavingUTR(false)
    }
  }

  const tabs = [
    { key: 'undervalued',    label: 'Undervalued',       count: data?.undervalued.length || 0 },
    { key: 'rising',         label: 'Rising Stars',       count: data?.risingStars.length || 0 },
    { key: 'risingRankings', label: 'Rising Rankings',    count: data?.risingRankings.length || 0 },
    { key: 'undercontacted', label: 'Under-contacted',    count: data?.undercontacted.length || 0 },
    { key: 'all',            label: 'All Recruits',       count: data?.all.length || 0 },
  ]

  const activeRecruits =
    activeTab === 'undervalued'    ? data?.undervalued :
    activeTab === 'rising'         ? data?.risingStars :
    activeTab === 'risingRankings' ? data?.risingRankings :
    activeTab === 'undercontacted' ? data?.undercontacted :
    data?.all

  return (
    <main className="min-h-screen bg-[#0a1628] text-white font-sans">

      {/* HEADER */}
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors text-sm">
            ← Dashboard
          </Link>
          <span className="text-white/20">/</span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Scouting Discovery</h1>
            <p className="text-sm text-slate-400 mt-0.5">Find undervalued players before anyone else</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddUTR(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Log UTR Rating
        </button>
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto">

        {/* STATS */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Rising Stars',
              value: data?.risingStars.length || 0,
              sub: 'UTR trending up 0.5+',
              color: 'text-green-400'
            },
            {
              label: 'Rising Rankings',
              value: data?.risingRankings.length || 0,
              sub: 'Rank improved 2+ places',
              color: 'text-emerald-400'
            },
            {
              label: 'Undervalued',
              value: data?.undervalued.length || 0,
              sub: 'High fit, not high priority',
              color: 'text-yellow-400'
            },
            {
              label: 'Under-contacted',
              value: data?.undercontacted.length || 0,
              sub: 'High fit, 14+ days no contact',
              color: 'text-orange-400'
            },
          ].map((stat, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                {stat.label}
              </p>
              <p className="text-3xl font-semibold">{stat.value}</p>
              <p className={`text-xs mt-1.5 font-medium ${stat.color}`}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-blue-500' : 'bg-white/10'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* RECRUIT LIST */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <p className="text-sm text-slate-400">
              {activeTab === 'undervalued'    && 'Players in your target ranking range with high fit scores not yet marked High priority'}
              {activeTab === 'rising'         && 'Players whose UTR has increased by 0.5 or more — trending up fast'}
              {activeTab === 'risingRankings' && 'Players whose national ranking has improved by 2 or more places — climbing the charts'}
              {activeTab === 'undercontacted' && 'High fit players you haven\'t reached out to recently'}
              {activeTab === 'all'            && 'All recruits with UTR and ranking trend analysis'}
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-slate-500">
              <p className="text-sm">Loading discovery data...</p>
            </div>
          ) : !activeRecruits || activeRecruits.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              <p className="text-sm">No recruits in this category yet.</p>
              {activeTab === 'rising' && (
                <p className="text-xs mt-2">Log multiple UTR ratings over time to track trends.</p>
              )}
              {activeTab === 'risingRankings' && (
                <p className="text-xs mt-2">Rankings sync automatically every 24h for recruits with a TennisRecruiting ID.</p>
              )}
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-3">
              {activeRecruits.map(recruit => (
                <RecruitCard key={recruit.id} recruit={recruit} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ADD UTR MODAL */}
      {showAddUTR && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f2040] border border-white/15 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white">Log UTR Rating</h2>
                <p className="text-xs text-slate-400 mt-0.5">Track UTR over time to spot trends</p>
              </div>
              <button
                onClick={() => setShowAddUTR(false)}
                className="text-slate-500 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Recruit
                </label>
                <select
                  value={utrForm.recruit_id}
                  onChange={e => setUtrForm(f => ({ ...f, recruit_id: e.target.value }))}
                  className="w-full bg-[#0f2040] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">Select a recruit...</option>
                  {data?.all.map(r => (
                    <option key={r.id} value={r.id} className="bg-[#0f2040]">
                      {r.name} — #{r.national_ranking}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    UTR Rating
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={utrForm.utr_rating}
                    onChange={e => setUtrForm(f => ({ ...f, utr_rating: e.target.value }))}
                    placeholder="e.g. 13.50"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={utrForm.recorded_date}
                    onChange={e => setUtrForm(f => ({ ...f, recorded_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAddUTR(false)}
                className="text-sm text-slate-400 hover:text-white px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUTR}
                disabled={savingUTR || !utrForm.recruit_id || !utrForm.utr_rating}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                {savingUTR ? 'Saving...' : 'Log Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
