import { useEffect, useState } from 'react'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = 'http://localhost:3000'

const SPECIALTIES = [
  'General Dentistry', 'Orthodontics', 'Periodontics',
  'Endodontics', 'Oral Surgery', 'Hygiene', 'Front Desk',
]

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  filled: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const CLAIM_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
}

interface Location { id: string; name: string }

interface Claim {
  id: string
  userId: string
  user: { id: string; firstName: string; lastName: string }
  status: string
  createdAt: string
}

interface OpenShift {
  id: string
  locationId: string
  location: { id: string; name: string }
  date: string
  startTime: string
  endTime: string
  specialty: string | null
  notes: string | null
  status: string
  createdAt: string
  claims: Claim[]
}

interface ShiftForm {
  locationId: string
  date: string
  startTime: string
  endTime: string
  specialty: string
  notes: string
}

const emptyForm: ShiftForm = {
  locationId: '', date: '', startTime: '09:00', endTime: '17:00', specialty: '', notes: '',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime12h(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function OpenShifts() {
  const [shifts, setShifts] = useState<OpenShift[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [statusFilter, setStatusFilter] = useState<'open' | 'filled' | 'cancelled' | 'all'>('open')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ShiftForm>(emptyForm)
  const [posting, setPosting] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  async function fetchShifts() {
    try {
      const res = await fetch(`${API_BASE}/api/open-shifts?practiceId=${PRACTICE_ID}`)
      const data = await res.json()
      if (Array.isArray(data)) setShifts(data)
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchShifts()
    fetch(`${API_BASE}/api/locations?practiceId=${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((d) => setLocations(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  async function postShift() {
    if (!form.locationId || !form.date) return
    setPosting(true)
    try {
      const res = await fetch(`${API_BASE}/api/open-shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: PRACTICE_ID, ...form, specialty: form.specialty || undefined, notes: form.notes || undefined }),
      })
      if (res.ok) {
        const shift: OpenShift = await res.json()
        setShifts((prev) => [shift, ...prev])
        setShowForm(false)
        setForm(emptyForm)
      }
    } catch { /* silent */ }
    finally { setPosting(false) }
  }

  async function cancelShift(id: string) {
    if (!confirm('Cancel this open shift?')) return
    const res = await fetch(`${API_BASE}/api/open-shifts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (res.ok) {
      const updated: OpenShift = await res.json()
      setShifts((prev) => prev.map((s) => (s.id === id ? updated : s)))
    }
  }

  async function reviewClaim(claimId: string, shiftId: string, status: 'approved' | 'denied') {
    setReviewingId(claimId)
    try {
      const res = await fetch(`${API_BASE}/api/open-shifts/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) await fetchShifts()
    } catch { /* silent */ }
    finally { setReviewingId(null) }
  }

  const filtered = shifts.filter((s) => statusFilter === 'all' || s.status === statusFilter)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-gray-500 hover:text-gray-800">← Back</a>
            <span className="text-gray-300">|</span>
            <h1 className="text-xl font-bold text-gray-900">Open Shifts</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + Post Shift
          </button>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['open', 'all', 'filled', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                statusFilter === f ? 'bg-[#1D9E75] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
              {f !== 'all' && (
                <span className="ml-1 opacity-70">({shifts.filter((s) => s.status === f).length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Shifts table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Time</th>
                <th className="px-4 py-3 text-left font-semibold">Location</th>
                <th className="px-4 py-3 text-left font-semibold">Specialty</th>
                <th className="px-4 py-3 text-left font-semibold">Claims</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">No {statusFilter === 'all' ? '' : statusFilter} open shifts</td>
                </tr>
              ) : (
                filtered.map((shift) => (
                  <>
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{formatDate(shift.date)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatTime12h(shift.startTime)} – {formatTime12h(shift.endTime)}</td>
                      <td className="px-4 py-3 text-gray-600">{shift.location.name}</td>
                      <td className="px-4 py-3 text-gray-500">{shift.specialty ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(expandedId === shift.id ? null : shift.id)}
                          className="text-xs font-medium text-[#1D9E75] hover:underline"
                        >
                          {shift.claims.length} claim{shift.claims.length !== 1 ? 's' : ''} {expandedId === shift.id ? '▲' : '▼'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[shift.status] ?? ''}`}>
                          {shift.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {shift.status === 'open' && (
                          <button
                            onClick={() => cancelShift(shift.id)}
                            className="text-xs text-gray-400 hover:text-red-600"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded claims row */}
                    {expandedId === shift.id && (
                      <tr key={`${shift.id}-claims`}>
                        <td colSpan={7} className="bg-gray-50 px-6 py-4">
                          {shift.notes && (
                            <p className="mb-3 text-xs text-gray-500 italic">"{shift.notes}"</p>
                          )}
                          {shift.claims.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No claims yet</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {shift.claims.map((claim) => (
                                <div key={claim.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                                      style={{ backgroundColor: '#E1F5EE', color: '#085041' }}
                                    >
                                      {claim.user.firstName[0]}{claim.user.lastName[0]}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900">
                                      {claim.user.firstName} {claim.user.lastName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${CLAIM_STATUS_STYLES[claim.status] ?? ''}`}>
                                      {claim.status}
                                    </span>
                                    {claim.status === 'pending' && shift.status === 'open' && (
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => reviewClaim(claim.id, shift.id, 'approved')}
                                          disabled={reviewingId === claim.id}
                                          className="rounded px-2.5 py-1 text-xs font-medium text-[#1D9E75] hover:bg-[#E1F5EE] disabled:opacity-50"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => reviewClaim(claim.id, shift.id, 'denied')}
                                          disabled={reviewingId === claim.id}
                                          className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                        >
                                          Deny
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Post Shift modal */}
      {showForm && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-5 text-base font-semibold text-gray-900">Post Open Shift</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Start Time</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">End Time</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Location</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.locationId}
                  onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
                >
                  <option value="">Select location…</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Specialty <span className="text-gray-400">(optional)</span></label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.specialty}
                  onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                >
                  <option value="">Any specialty</option>
                  {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notes <span className="text-gray-400">(optional)</span></label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
                  placeholder="Any additional details…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowForm(false); setForm(emptyForm) }}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={postShift}
                disabled={posting || !form.locationId || !form.date}
                className="flex-1 rounded-lg bg-[#1D9E75] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {posting ? 'Posting…' : 'Post Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
