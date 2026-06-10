import { useEffect, useState, useMemo } from 'react'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const TYPE_COLORS: Record<string, string> = {
  vacation: 'bg-blue-100 text-blue-700',
  sick: 'bg-orange-100 text-orange-700',
  personal: 'bg-purple-100 text-purple-700',
}

const STAFF_PALETTE = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#14B8A6',
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface PtoRequest {
  id: string
  userId: string
  user: { id: string; firstName: string; lastName: string; role: string }
  startDate: string
  endDate: string
  type: string
  status: string
  notes: string | null
}

interface BlackoutDate {
  id: string
  date: string
  reason: string | null
}

type Tab = 'pending' | 'calendar' | 'blackout'

function formatDateDisplay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

function isoToLocal(iso: string): Date {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PtoAdmin() {
  const [tab, setTab] = useState<Tab>('pending')
  const [pendingRequests, setPendingRequests] = useState<PtoRequest[]>([])
  const [approvedRequests, setApprovedRequests] = useState<PtoRequest[]>([])
  const [blackouts, setBlackouts] = useState<BlackoutDate[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)

  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  const [newDate, setNewDate] = useState('')
  const [newReason, setNewReason] = useState('')
  const [addingBlackout, setAddingBlackout] = useState(false)

  async function fetchAll() {
    setLoading(true)
    try {
      const [pendRes, appRes, boutRes] = await Promise.all([
        fetch(`${API_BASE}/api/pto/requests?practiceId=${PRACTICE_ID}&status=pending`),
        fetch(`${API_BASE}/api/pto/requests?practiceId=${PRACTICE_ID}&status=approved`),
        fetch(`${API_BASE}/api/pto/blackout-dates?practiceId=${PRACTICE_ID}`),
      ])
      const [pend, app, bouts] = await Promise.all([
        pendRes.json(), appRes.json(), boutRes.json(),
      ])
      setPendingRequests(Array.isArray(pend) ? pend : [])
      setApprovedRequests(Array.isArray(app) ? app : [])
      setBlackouts(Array.isArray(bouts) ? bouts : [])
    } catch {
      // silent — keep stale data
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  async function handleAction(id: string, status: 'approved' | 'denied') {
    setActioningId(id)
    try {
      await fetch(`${API_BASE}/api/pto/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await fetchAll()
    } finally {
      setActioningId(null)
    }
  }

  async function handleAddBlackout() {
    if (!newDate) return
    setAddingBlackout(true)
    try {
      await fetch(`${API_BASE}/api/pto/blackout-dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: PRACTICE_ID,
          date: newDate,
          reason: newReason || undefined,
        }),
      })
      setNewDate('')
      setNewReason('')
      await fetchAll()
    } finally {
      setAddingBlackout(false)
    }
  }

  async function handleDeleteBlackout(id: string) {
    await fetch(`${API_BASE}/api/pto/blackout-dates/${id}`, { method: 'DELETE' })
    await fetchAll()
  }

  // Calendar: expand approved requests into a per-day map
  const calendarMap = useMemo(() => {
    const map = new Map<string, PtoRequest[]>()
    for (const req of approvedRequests) {
      const start = isoToLocal(req.startDate)
      const end = isoToLocal(req.endDate)
      const cur = new Date(start)
      while (cur <= end) {
        const key = dayKey(cur)
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(req)
        cur.setDate(cur.getDate() + 1)
      }
    }
    return map
  }, [approvedRequests])

  const blackoutSet = useMemo(
    () => new Set(blackouts.map((b) => b.date.split('T')[0])),
    [blackouts]
  )

  const userColorMap = useMemo(() => {
    const map = new Map<string, string>()
    let i = 0
    for (const req of approvedRequests) {
      if (!map.has(req.userId)) {
        map.set(req.userId, STAFF_PALETTE[i % STAFF_PALETTE.length])
        i++
      }
    }
    return map
  }, [approvedRequests])

  const calGrid = useMemo(() => {
    const first = new Date(calYear, calMonth, 1)
    const last = new Date(calYear, calMonth + 1, 0)
    const cells: (Date | null)[] = []
    for (let i = 0; i < first.getDay(); i++) cells.push(null)
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(calYear, calMonth, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [calYear, calMonth])

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1) }
    else setCalMonth((m) => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1) }
    else setCalMonth((m) => m + 1)
  }

  const uniqueApprovedUsers = useMemo(
    () => [...new Map(approvedRequests.map((r) => [r.userId, r])).values()],
    [approvedRequests]
  )

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <header className="bg-[#2C3E3A]">
        <div className="container flex h-16 items-center gap-3">
          <a href="/" className="text-sm text-[#8BAF9A] hover:text-white">← Back</a>
          <span className="text-[#4A5C52]">|</span>
          <h1 className="text-xl font-bold text-[#FAF6EF]">PTO Manager</h1>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-[#2C3E3A]">
        <div className="container flex">
          {([
            ['pending', 'Pending Requests', pendingRequests.length],
            ['calendar', 'Team Calendar', null],
            ['blackout', 'Blackout Dates', blackouts.length],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-[#1D9E75] text-[#1D9E75]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {count !== null && count > 0 && (
                <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  tab === key ? 'bg-[#E1F5EE] text-[#085041]' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="container py-8">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <>
            {/* ── PENDING REQUESTS ── */}
            {tab === 'pending' && (
              <div className="max-w-2xl space-y-4">
                {pendingRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center text-sm text-gray-400">
                    No pending requests
                  </div>
                ) : (
                  pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">
                              {req.user.firstName} {req.user.lastName}
                            </span>
                            <span className="text-xs text-gray-400 capitalize">{req.user.role}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                                TYPE_COLORS[req.type] ?? 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {req.type}
                            </span>
                            <span className="text-sm text-gray-600">
                              {formatDateDisplay(req.startDate)}
                              {req.startDate.split('T')[0] !== req.endDate.split('T')[0] &&
                                ` – ${formatDateDisplay(req.endDate)}`}
                            </span>
                          </div>
                          {req.notes && (
                            <p className="text-sm text-gray-500 italic">"{req.notes}"</p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => handleAction(req.id, 'denied')}
                            disabled={actioningId === req.id}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-[#F0EDE5] disabled:opacity-50"
                          >
                            Deny
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'approved')}
                            disabled={actioningId === req.id}
                            className="rounded-lg bg-[#1D9E75] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── TEAM CALENDAR ── */}
            {tab === 'calendar' && (
              <div>
                <div className="mb-6 flex items-center gap-4">
                  <button
                    onClick={prevMonth}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-[#F0EDE5]"
                  >
                    ←
                  </button>
                  <h2 className="min-w-[180px] text-center text-lg font-semibold text-gray-800">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </h2>
                  <button
                    onClick={nextMonth}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-[#F0EDE5]"
                  >
                    →
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  {/* Day-of-week header */}
                  <div className="grid grid-cols-7 border-b bg-[#EFECE4]">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div
                        key={d}
                        className="border-r py-2 text-center text-xs font-semibold uppercase text-gray-500 last:border-r-0"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {calGrid.map((date, idx) => {
                      if (!date) {
                        return (
                          <div
                            key={`empty-${idx}`}
                            className="h-28 border-r border-b bg-[#EFECE4] last:border-r-0"
                          />
                        )
                      }
                      const key = dayKey(date)
                      const isBlackout = blackoutSet.has(key)
                      const isToday = key === dayKey(today)
                      const dayReqs = calendarMap.get(key) ?? []

                      return (
                        <div
                          key={key}
                          className={`h-28 overflow-hidden border-r border-b p-1.5 last:border-r-0 ${
                            isBlackout ? 'bg-red-50' : 'bg-white'
                          }`}
                        >
                          <div
                            className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                              isToday
                                ? 'bg-[#1D9E75] text-white'
                                : isBlackout
                                ? 'text-red-500'
                                : 'text-gray-700'
                            }`}
                          >
                            {date.getDate()}
                          </div>
                          {isBlackout && (
                            <div className="mb-0.5 text-xs font-medium text-red-400">
                              Blackout
                            </div>
                          )}
                          <div className="space-y-0.5">
                            {dayReqs.slice(0, 3).map((req) => (
                              <div
                                key={req.id}
                                className="truncate rounded px-1 py-0.5 text-xs font-medium text-white"
                                style={{
                                  backgroundColor: userColorMap.get(req.userId) ?? '#3B82F6',
                                }}
                              >
                                {req.user.firstName} {req.user.lastName.charAt(0)}.
                              </div>
                            ))}
                            {dayReqs.length > 3 && (
                              <div className="text-xs text-gray-400">
                                +{dayReqs.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Legend */}
                {(uniqueApprovedUsers.length > 0 || blackouts.length > 0) && (
                  <div className="mt-4 flex flex-wrap gap-4">
                    {uniqueApprovedUsers.map((req) => (
                      <div key={req.userId} className="flex items-center gap-1.5">
                        <div
                          className="h-3 w-3 rounded-sm"
                          style={{ backgroundColor: userColorMap.get(req.userId) }}
                        />
                        <span className="text-xs text-gray-600">
                          {req.user.firstName} {req.user.lastName}
                        </span>
                      </div>
                    ))}
                    {blackouts.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-sm bg-red-200" />
                        <span className="text-xs text-gray-600">Blackout date</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── BLACKOUT DATES ── */}
            {tab === 'blackout' && (
              <div className="max-w-xl space-y-6">
                {/* Add form */}
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-sm font-semibold text-gray-800">Block a date</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Reason{' '}
                        <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Office closed, Holiday…"
                        value={newReason}
                        onChange={(e) => setNewReason(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      />
                    </div>
                    <button
                      onClick={handleAddBlackout}
                      disabled={!newDate || addingBlackout}
                      className="rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {addingBlackout ? 'Adding…' : 'Add blackout date'}
                    </button>
                  </div>
                </div>

                {/* Existing list */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">
                    Blocked dates ({blackouts.length})
                  </h3>
                  {blackouts.length === 0 ? (
                    <p className="text-sm text-gray-400">No blackout dates configured.</p>
                  ) : (
                    <div className="space-y-2">
                      {blackouts.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {formatDateDisplay(b.date)}
                            </p>
                            {b.reason && (
                              <p className="text-xs text-gray-500">{b.reason}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteBlackout(b.id)}
                            className="text-xs font-medium text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
