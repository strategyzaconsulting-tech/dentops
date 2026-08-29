import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/apiFetch'

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
  type: string
  name: string | null
}

type Tab = 'pending' | 'calendar' | 'blackout' | 'closures'

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
  const { user } = useAuth()
  const PRACTICE_ID = user!.practiceId
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

  const [closures, setClosures] = useState<BlackoutDate[]>([])
  const [newClosureDate, setNewClosureDate] = useState('')
  const [newClosureName, setNewClosureName] = useState('')
  const [addingClosure, setAddingClosure] = useState(false)

  async function fetchAll() {
    setLoading(true)
    try {
      const [pendRes, appRes, boutRes, closureRes] = await Promise.all([
        apiFetch(`/api/pto/requests?practiceId=${PRACTICE_ID}&status=pending`),
        apiFetch(`/api/pto/requests?practiceId=${PRACTICE_ID}&status=approved`),
        apiFetch(`/api/pto/blackout-dates?practiceId=${PRACTICE_ID}&type=blackout`),
        apiFetch(`/api/pto/blackout-dates?practiceId=${PRACTICE_ID}&type=closure`),
      ])
      const [pend, app, bouts, cls] = await Promise.all([
        pendRes.json(), appRes.json(), boutRes.json(), closureRes.json(),
      ])
      setPendingRequests(Array.isArray(pend) ? pend : [])
      setApprovedRequests(Array.isArray(app) ? app : [])
      setBlackouts(Array.isArray(bouts) ? bouts : [])
      setClosures(Array.isArray(cls) ? cls : [])
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
      await apiFetch(`/api/pto/requests/${id}`, {
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
      await apiFetch(`/api/pto/blackout-dates`, {
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
    await apiFetch(`/api/pto/blackout-dates/${id}`, { method: 'DELETE' })
    await fetchAll()
  }

  async function handleAddClosure() {
    if (!newClosureName.trim() || !newClosureDate) return
    setAddingClosure(true)
    try {
      await apiFetch('/api/pto/blackout-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: PRACTICE_ID, date: newClosureDate, name: newClosureName.trim(), type: 'closure' }),
      })
      setNewClosureDate('')
      setNewClosureName('')
      await fetchAll()
    } finally { setAddingClosure(false) }
  }

  async function handleDeleteClosure(id: string) {
    await apiFetch(`/api/pto/blackout-dates/${id}`, { method: 'DELETE' })
    setClosures(prev => prev.filter(c => c.id !== id))
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

  const closureSet = useMemo(
    () => new Map(closures.map((c) => [c.date.split('T')[0], c.name ?? 'Office Closed'])),
    [closures]
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
            ['closures', 'Office Calendar', closures.length],
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
                      const closureName = closureSet.get(key)
                      const isToday = key === dayKey(today)
                      const dayReqs = calendarMap.get(key) ?? []

                      return (
                        <div
                          key={key}
                          className={`h-28 overflow-hidden border-r border-b p-1.5 last:border-r-0 ${
                            closureName ? 'bg-purple-50' : isBlackout ? 'bg-red-50' : 'bg-white'
                          }`}
                        >
                          <div
                            className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                              isToday
                                ? 'bg-[#1D9E75] text-white'
                                : closureName
                                ? 'text-purple-600'
                                : isBlackout
                                ? 'text-red-500'
                                : 'text-gray-700'
                            }`}
                          >
                            {date.getDate()}
                          </div>
                          {closureName && (
                            <div className="mb-0.5 truncate text-xs font-medium text-purple-600">
                              🏢 {closureName}
                            </div>
                          )}
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

            {/* Office Calendar (closures) tab */}
            {tab === 'closures' && (
              <div className="max-w-2xl space-y-6">
                {/* Add closure form */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-1 text-sm font-semibold text-gray-800">Add Office Closure</h3>
                  <p className="mb-4 text-xs text-gray-500">Mark holidays, training days, and other dates when the office is closed. These appear on the Team Calendar.</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Date <span className="text-red-400">*</span></label>
                      <input type="date" value={newClosureDate} onChange={e => setNewClosureDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Name <span className="text-red-400">*</span></label>
                      <input type="text" placeholder="e.g. Independence Day, Staff Training" value={newClosureName} onChange={e => setNewClosureName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]" />
                    </div>
                  </div>
                  <button onClick={handleAddClosure} disabled={!newClosureDate || !newClosureName.trim() || addingClosure} className="rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {addingClosure ? 'Adding…' : '+ Add Closure'}
                  </button>
                </div>

                {/* Closure calendar view */}
                {closures.length > 0 && (() => {
                  // Group by year/month
                  const grouped = new Map<string, typeof closures>()
                  for (const c of [...closures].sort((a, b) => a.date.localeCompare(b.date))) {
                    const key = c.date.split('T')[0].slice(0, 7) // YYYY-MM
                    if (!grouped.has(key)) grouped.set(key, [])
                    grouped.get(key)!.push(c)
                  }
                  return (
                    <div className="space-y-4">
                      {[...grouped.entries()].map(([monthKey, items]) => {
                        const [y, m] = monthKey.split('-').map(Number)
                        const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        return (
                          <div key={monthKey}>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{monthLabel}</h4>
                            <div className="space-y-2">
                              {items.map(c => {
                                const d = new Date(c.date.split('T')[0] + 'T12:00:00')
                                const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
                                const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                return (
                                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <span className="text-purple-400 text-lg">🏢</span>
                                      <div>
                                        <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                                        <p className="text-xs text-gray-500">{weekday}, {dateLabel}</p>
                                      </div>
                                    </div>
                                    <button onClick={() => handleDeleteClosure(c.id)} className="text-xs font-medium text-gray-400 hover:text-red-500">Remove</button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {closures.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
                    <p className="text-sm text-gray-400">No office closures on file.</p>
                    <p className="text-xs text-gray-400 mt-1">Add holidays and closure days above — they'll appear on the Team Calendar.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
