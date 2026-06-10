import { useEffect, useState } from 'react'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = 'http://localhost:3000'

interface Announcement {
  id: string
  title: string
  body: string
  createdAt: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchAnnouncements() {
    try {
      const res = await fetch(`${API_BASE}/api/announcements?practiceId=${PRACTICE_ID}`)
      const data = await res.json()
      if (Array.isArray(data)) setAnnouncements(data)
    } catch { /* silent */ }
  }

  useEffect(() => { fetchAnnouncements() }, [])

  async function postAnnouncement() {
    if (!title.trim() || !body.trim()) return
    setPosting(true)
    try {
      const res = await fetch(`${API_BASE}/api/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: PRACTICE_ID, title: title.trim(), body: body.trim() }),
      })
      if (res.ok) {
        const item: Announcement = await res.json()
        setAnnouncements((prev) => [item, ...prev])
        setTitle('')
        setBody('')
        setShowForm(false)
      }
    } catch { /* silent */ }
    finally { setPosting(false) }
  }

  async function deleteAnnouncement(id: string) {
    if (!confirm('Delete this announcement?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`${API_BASE}/api/announcements/${id}`, { method: 'DELETE' })
      if (res.ok) setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    } catch { /* silent */ }
    finally { setDeletingId(null) }
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-[#2C3E3A]">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-[#8BAF9A] hover:text-white">← Back</a>
            <span className="text-[#4A5C52]">|</span>
            <h1 className="text-xl font-bold text-[#FAF6EF]">Announcements</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + New Announcement
          </button>
        </div>
      </header>

      <main className="container py-8 space-y-4 max-w-2xl">
        {announcements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center text-gray-400">
            No announcements yet. Post one to notify your staff.
          </div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-base">{a.title}</p>
                  <p className="mt-1.5 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{a.body}</p>
                  <p className="mt-3 text-xs text-gray-400">{formatDate(a.createdAt)}</p>
                </div>
                <button
                  onClick={() => deleteAnnouncement(a.id)}
                  disabled={deletingId === a.id}
                  className="shrink-0 text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 pt-0.5"
                >
                  {deletingId === a.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* New announcement modal */}
      {showForm && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-5 text-base font-semibold text-gray-900">New Announcement</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  placeholder="e.g. Office closed Friday"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Message</label>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
                  placeholder="Details for your staff…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowForm(false); setTitle(''); setBody('') }}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={postAnnouncement}
                disabled={posting || !title.trim() || !body.trim()}
                className="flex-1 rounded-lg bg-[#1D9E75] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
