'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  recruitId: string
  recruitName: string
}

export default function DeleteRecruitButton({ recruitId, recruitName }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/recruits?id=${recruitId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete')

      router.push('/')
      router.refresh()
    } catch (err) {
      console.error(err)
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Delete {recruitName}?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          {loading ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-1.5 border border-white/10 hover:border-red-500/30 rounded-lg"
    >
      Delete Recruit
    </button>
  )
}