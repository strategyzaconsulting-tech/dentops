import { useEffect, useRef, useState } from 'react'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = 'http://localhost:3000'

const SPECIALTIES = [
  'General Dentistry',
  'Orthodontics',
  'Periodontics',
  'Endodontics',
  'Oral Surgery',
  'Hygiene',
  'Front Desk',
]

interface LivePunch {
  id: string
  userId: string
  user: { firstName: string; lastName: string }
  locationId: string
  location: { name: string }
  specialty: string | null
  punchIn: string
  breakStart: string | null
  breakEnd: string | null
}

interface TodayPunch {
  id: string
  userId: string
  user: { firstName: string; lastName: string }
  locationId: string
  location: { name: string }
  specialty: string | null
  punchIn: string
  punchOut: string | null
  breakStart: string | null
  breakEnd: string | null
}

interface LocationItem {
  id: string
  name: string
}

interface EditState {
  punch: TodayPunch
  punchIn: string
  punchOut: string
  locationId: string
  specialty: string
}

function formatHm(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${ampm}`
}

function formatElapsed(punchIn: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(punchIn).getTime()) / 1000))
  const h = Math.floor(secs / 3600).toString().padStart(2, '0')
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatDuration(punchIn: string, punchOut: string | null, breakStart: string | null, breakEnd: string | null, now: number): string {
  const start = new Date(punchIn).getTime()
  const end = punchOut ? new Date(punchOut).getTime() : now
  let totalMs = end - start
  if (breakStart && breakEnd) {
    totalMs -= new Date(breakEnd).getTime() - new Date(breakStart).getTime()
  }
  if (totalMs < 0) totalMs = 0
  const totalMins = Math.floor(totalMs / 60000)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatBreak(breakStart: string | null, breakEnd: string | null): string {
  if (!breakStart) return '—'
  if (!breakEnd) return 'Active'
  const mins = Math.round((new Date(breakEnd).getTime() - new Date(breakStart).getTime()) / 60000)
  return `${mins} min`
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TimeClock() {
  const [livePunches, setLivePunches] = useState<LivePunch[]>([])
  const [todayPunches, setTodayPunches] = useState<TodayPunch[]>([])
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [lastUpdated, setLastUpdated] = useState<number>(0)
  const [secondsSince, setSecondsSince] = useState<number>(0)
  const [now, setNow] = useState<number>(Date.now())
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [requireSpecialty, setRequireSpecialty] = useState(false)
  const [togglingSpecialty, setTogglingSpecialty] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchData() {
    try {
      const [liveRes, todayRes] = await Promise.all([
        fetch(`${API_BASE}/api/time-punches/live?practiceId=${PRACTICE_ID}`),
        fetch(`${API_BASE}/api/time-punches/today?practiceId=${PRACTICE_ID}`),
      ])
      const [liveData, todayData] = await Promise.all([liveRes.json(), todayRes.json()])
      setLivePunches(Array.isArray(liveData) ? liveData : [])
      setTodayPunches(Array.isArray(todayData) ? todayData : [])
      setLastUpdated(Date.now())
      setSecondsSince(0)
    } catch {
      // silent fail — keep stale data
    }
  }

  useEffect(() => {
    fetchData()
    pollRef.current = setInterval(fetchData, 30000)

    // per-second ticker for elapsed displays + "last updated X ago"
    tickRef.current = setInterval(() => {
      setNow(Date.now())
      setSecondsSince((s) => s + 1)
    }, 1000)

    // fetch locations for edit modal
    fetch(`${API_BASE}/api/locations?practiceId=${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((data: LocationItem[]) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => {})

    // fetch practice settings
    fetch(`${API_BASE}/api/practice/${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((data) => { if (typeof data?.requireSpecialty === 'boolean') setRequireSpecialty(data.requireSpecialty) })
      .catch(() => {})

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  function openEdit(punch: TodayPunch) {
    setEditState({
      punch,
      punchIn: toDatetimeLocal(punch.punchIn),
      punchOut: toDatetimeLocal(punch.punchOut),
      locationId: punch.locationId,
      specialty: punch.specialty ?? '',
    })
  }

  async function toggleRequireSpecialty() {
    setTogglingSpecialty(true)
    try {
      const next = !requireSpecialty
      await fetch(`${API_BASE}/api/practice/${PRACTICE_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requireSpecialty: next }),
      })
      setRequireSpecialty(next)
    } catch {
      // swallow
    } finally {
      setTogglingSpecialty(false)
    }
  }

  async function saveEdit() {
    if (!editState) return
    setSaving(true)
    try {
      const body: Record<string, string | undefined> = {
        punchIn: editState.punchIn ? new Date(editState.punchIn).toISOString() : undefined,
        punchOut: editState.punchOut ? new Date(editState.punchOut).toISOString() : undefined,
        locationId: editState.locationId || undefined,
        specialty: editState.specialty || undefined,
      }
      // remove undefined keys
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k])

      await fetch(`${API_BASE}/api/time-punches/${editState.punch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setEditState(null)
      await fetchData()
    } catch {
      // swallow
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-gray-500 hover:text-gray-800">
              ← Back
            </a>
            <span className="text-gray-300">|</span>
            <h1 className="text-xl font-bold text-gray-900">Time Clock</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Live
            </span>
            <span className="text-xs text-gray-400">
              {lastUpdated === 0 ? 'Fetching…' : `Last updated ${secondsSince}s ago`}
            </span>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-10">
        {/* Clock-in settings */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Clock-In Settings</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Require specialty on clock-in</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Staff must select a specialty before clocking in from the mobile app.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={requireSpecialty}
                onClick={toggleRequireSpecialty}
                disabled={togglingSpecialty}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                  requireSpecialty ? 'bg-[#1D9E75]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    requireSpecialty ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Live board */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Currently clocked in</h2>
          {livePunches.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-16 text-gray-400">
              <svg
                className="mb-3 h-10 w-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                <path d="M12 6v6l4 2" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium">No staff currently clocked in</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {livePunches.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                      style={{ backgroundColor: '#E1F5EE', color: '#085041' }}
                    >
                      {initials(p.user.firstName, p.user.lastName)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {p.user.firstName} {p.user.lastName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatElapsed(p.punchIn, now)}
                      </p>
                    </div>
                    {p.breakStart && !p.breakEnd && (
                      <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        On break
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                      {p.location.name}
                    </span>
                    {p.specialty && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: '#E1F5EE', color: '#085041' }}
                      >
                        {p.specialty}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Today's log */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Today's punches</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <th className="px-4 py-3 text-left font-semibold">Staff</th>
                  <th className="px-4 py-3 text-left font-semibold">Location</th>
                  <th className="px-4 py-3 text-left font-semibold">Specialty</th>
                  <th className="px-4 py-3 text-left font-semibold">Clock In</th>
                  <th className="px-4 py-3 text-left font-semibold">Clock Out</th>
                  <th className="px-4 py-3 text-left font-semibold">Break</th>
                  <th className="px-4 py-3 text-left font-semibold">Duration</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {todayPunches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-400">
                      No punches recorded today
                    </td>
                  </tr>
                ) : (
                  todayPunches.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {p.user.firstName} {p.user.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.location.name}</td>
                      <td className="px-4 py-3 text-gray-600">{p.specialty ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{formatHm(p.punchIn)}</td>
                      <td className="px-4 py-3">
                        {p.punchOut ? (
                          <span className="text-gray-600">{formatHm(p.punchOut)}</span>
                        ) : (
                          <span className="italic text-gray-400">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatBreak(p.breakStart, p.breakEnd)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDuration(p.punchIn, p.punchOut, p.breakStart, p.breakEnd, now)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded px-2.5 py-1 text-xs font-medium text-[#1D9E75] hover:bg-[#E1F5EE]"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Edit modal */}
      {editState && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditState(null)
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-5 text-base font-semibold text-gray-900">
              Edit punch — {editState.punch.user.firstName} {editState.punch.user.lastName}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Clock In</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={editState.punchIn}
                  onChange={(e) => setEditState((s) => s ? { ...s, punchIn: e.target.value } : s)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Clock Out <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={editState.punchOut}
                  onChange={(e) => setEditState((s) => s ? { ...s, punchOut: e.target.value } : s)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Location</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={editState.locationId}
                  onChange={(e) => setEditState((s) => s ? { ...s, locationId: e.target.value } : s)}
                >
                  <option value="">Select location…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Specialty</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={editState.specialty}
                  onChange={(e) => setEditState((s) => s ? { ...s, specialty: e.target.value } : s)}
                >
                  <option value="">Select specialty…</option>
                  {SPECIALTIES.map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditState(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 rounded-lg bg-[#1D9E75] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
