'use client'

import { useState, useEffect, useRef } from 'react'

interface Document {
  id: string
  name: string
  type: string
  size: number
  storage_path: string
  uploaded_by: string
  created_at: string
}

interface Props {
  recruitId: string
}

function getFileIcon(type: string): string {
  if (type.includes('pdf')) return '📄'
  if (type.includes('image')) return '🖼️'
  if (type.includes('video')) return '🎥'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.includes('sheet') || type.includes('excel')) return '📊'
  return '📎'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentUpload({ recruitId }: Props) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDocuments()
  }, [recruitId])

  async function fetchDocuments() {
    try {
      const res = await fetch(`/api/documents?recruit_id=${recruitId}`)
      const data = await res.json()
      if (data.success) setDocuments(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('recruit_id', recruitId)

        const res = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()
        if (data.success) {
          setDocuments(prev => [data.data, ...prev])
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: Document) {
    try {
      await fetch(`/api/documents?id=${doc.id}&path=${encodeURIComponent(doc.storage_path)}`, {
        method: 'DELETE',
      })
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDownload(doc: Document) {
    try {
      const res = await fetch(`/api/documents/download?path=${encodeURIComponent(doc.storage_path)}`)
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
          Documents & Media
        </h2>
        <span className="text-xs text-slate-500">{documents.length} files</span>
      </div>

      {/* DROP ZONE */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          handleUpload(e.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-4 ${
          dragOver
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-white/10 hover:border-white/20 hover:bg-white/3'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.mp4,.mov,.txt"
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Uploading...</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400">
              Drop files here or <span className="text-blue-400 font-medium">browse</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              PDFs, Word docs, spreadsheets, images, videos
            </p>
          </>
        )}
      </div>

      {/* DOCUMENT LIST */}
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-4">Loading...</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">
          No documents uploaded yet
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 bg-white/3 border border-white/5 rounded-xl group"
            >
              <span className="text-xl flex-shrink-0">{getFileIcon(doc.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{doc.name}</p>
                <p className="text-xs text-slate-500">
                  {formatSize(doc.size)} · {new Date(doc.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(doc)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1"
                >
                  Download
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}