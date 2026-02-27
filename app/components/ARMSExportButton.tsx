'use client'

export default function ARMSExportButton() {
  function handleExport() {
    const a = document.createElement('a')
    a.href = '/api/exports/arms?recruit_id=all'
    a.download = 'arms-export.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <button
      onClick={handleExport}
      className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 border border-white/10 hover:border-white/20 rounded-lg"
    >
      ↓ ARMS Export
    </button>
  )
}
