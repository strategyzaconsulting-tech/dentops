import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/apiFetch'

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
  isTardy: boolean
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
  isTardy: boolean
}

interface RangePunch {
  id: string
  userId: string
  user: { firstName: string; lastName: string; role: string }
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

interface AdjustmentRequest {
  id: string
  userId: string
  user: { firstName: string; lastName: string }
  punchId: string | null
  date: string
  type: string
  notes: string
  status: string
  createdAt: string
  correctedPunchIn: string | null
  correctedPunchOut: string | null
  reviewedAt: string | null
  reviewNotes: string | null
}

interface PracticePayroll {
  payrollPeriod: string | null
  payrollStartDay: number | null
  payrollNextDate: string | null
}

interface OccurrenceRecord {
  id: string
  userId: string
  date: string
  type: string
  notes: string | null
}

type TcView = 'payperiod' | 'weekly' | 'monthly' | 'yearly'

interface EditState {
  punch: { id: string; user: { firstName: string; lastName: string } }
  punchIn: string
  punchOut: string
  locationId: string
  specialty: string
  fromTimecard?: boolean
}

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  missed_clock_in: 'Missed Clock-In',
  missed_clock_out: 'Missed Clock-Out',
  wrong_time: 'Wrong Time',
  other: 'Other',
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

function formatHrs(totalMins: number): string {
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function minutesWorked(p: RangePunch): number | null {
  if (!p.punchOut) return null
  let ms = new Date(p.punchOut).getTime() - new Date(p.punchIn).getTime()
  if (p.breakStart && p.breakEnd) {
    ms -= new Date(p.breakEnd).getTime() - new Date(p.breakStart).getTime()
  }
  return Math.max(0, Math.round(ms / 60000))
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const d = new Date(start)
  d.setHours(0, 0, 0, 0)
  const e = new Date(end)
  e.setHours(0, 0, 0, 0)
  while (d <= e) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function getPeriodBounds(anchor: Date, view: TcView, payroll: PracticePayroll | null): { start: Date; end: Date; label: string } {
  const d = new Date(anchor)
  d.setHours(0, 0, 0, 0)

  if (view === 'weekly') {
    const day = d.getDay()
    const daysToMon = day === 0 ? -6 : 1 - day
    const start = new Date(d)
    start.setDate(d.getDate() + daysToMon)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end, label: `${shortDate(start)} – ${shortDate(end)}` }
  }

  if (view === 'monthly') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { start, end, label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) }
  }

  if (view === 'yearly') {
    const y = d.getFullYear()
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31), label: String(y) }
  }

  // payperiod
  const period = payroll?.payrollPeriod
  const nextDateStr = payroll?.payrollNextDate

  if (!period || !nextDateStr) {
    return getPeriodBounds(anchor, 'weekly', null)
  }

  if (period === 'monthly') {
    return getPeriodBounds(anchor, 'monthly', null)
  }

  if (period === 'semimonthly') {
    const startDay = payroll?.payrollStartDay ?? 1
    const midDay = startDay + 15
    let start: Date, end: Date
    if (d.getDate() < midDay) {
      start = new Date(d.getFullYear(), d.getMonth(), startDay)
      end = new Date(d.getFullYear(), d.getMonth(), midDay - 1)
    } else {
      start = new Date(d.getFullYear(), d.getMonth(), midDay)
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    }
    return { start, end, label: `${shortDate(start)} – ${shortDate(end)}` }
  }

  // weekly or biweekly — use nextDate as period boundary anchor
  const periodLen = period === 'biweekly' ? 14 : 7
  const nextDate = new Date(nextDateStr)
  nextDate.setHours(0, 0, 0, 0)
  const daysDiff = Math.floor((d.getTime() - nextDate.getTime()) / 86400000)
  const periodIdx = daysDiff >= 0
    ? Math.floor(daysDiff / periodLen)
    : Math.floor(daysDiff / periodLen) // negative floor gives correct backwards period
  const start = new Date(nextDate)
  start.setDate(nextDate.getDate() + periodIdx * periodLen)
  const end = new Date(start)
  end.setDate(start.getDate() + periodLen - 1)
  return { start, end, label: `${shortDate(start)} – ${shortDate(end)}` }
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
  const { user } = useAuth()
  const PRACTICE_ID = user!.practiceId

  // Live + today
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
  const [adjustments, setAdjustments] = useState<AdjustmentRequest[]>([])
  const [adjFilter, setAdjFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('pending')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [expandedAdjId, setExpandedAdjId] = useState<string | null>(null)
  const [managerNote, setManagerNote] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Timecards
  const [practicePayroll, setPracticePayroll] = useState<PracticePayroll | null>(null)
  const [tcView, setTcView] = useState<TcView>('payperiod')
  const [tcAnchor, setTcAnchor] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [tcUserId, setTcUserId] = useState('')
  const [tcPunches, setTcPunches] = useState<RangePunch[]>([])
  const [tcOccurrences, setTcOccurrences] = useState<OccurrenceRecord[]>([])
  const [tcLoading, setTcLoading] = useState(false)
  const [tcStaff, setTcStaff] = useState<{ id: string; firstName: string; lastName: string; role: string }[]>([])
  const [tcDateRange, setTcDateRange] = useState<{ start: Date; end: Date } | null>(null)

  async function fetchData() {
    try {
      const [liveRes, todayRes] = await Promise.all([
        apiFetch(`/api/time-punches/live?practiceId=${PRACTICE_ID}`),
        apiFetch(`/api/time-punches/today?practiceId=${PRACTICE_ID}`),
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

  async function fetchTimecards(start: Date, end: Date) {
    setTcLoading(true)
    setTcDateRange({ start, end })
    setTcPunches([])
    setTcOccurrences([])
    const s = start.toISOString().split('T')[0]
    const e = end.toISOString().split('T')[0]

    // Punches are primary — fetch independently so occurrences can never block them
    try {
      const punchUrl = tcUserId
        ? `/api/time-punches/range?start=${s}&end=${e}&userId=${tcUserId}`
        : `/api/time-punches/range?start=${s}&end=${e}`
      const punchRes = await apiFetch(punchUrl)
      const punchData: RangePunch[] = await punchRes.json()
      const punches = Array.isArray(punchData) ? punchData : []
      setTcPunches(punches)
      setTcStaff(prev => {
        const map = new Map(prev.map(st => [st.id, st]))
        punches.forEach(p => {
          if (!map.has(p.userId)) map.set(p.userId, { id: p.userId, ...p.user })
        })
        return Array.from(map.values()).sort((a, b) => a.lastName.localeCompare(b.lastName))
      })
    } catch {
      // silent
    }

    // Occurrences are supplementary — failure here must not affect punch display
    try {
      const occUrl = `/api/occurrences?practiceId=${PRACTICE_ID}&startDate=${s}&endDate=${e}`
      const occRes = await apiFetch(occUrl)
      const occData: OccurrenceRecord[] = await occRes.json()
      setTcOccurrences(Array.isArray(occData) ? occData.filter(o => o.type === 'tardy' || o.type === 'unexcused_absence') : [])
    } catch {
      setTcOccurrences([])
    }

    setTcLoading(false)
  }

  function downloadCSV() {
    const { start, end } = tcPeriod
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const periodLabel = `${s} – ${e}`

    let csv = ''
    if (tcUserId) {
      const myPunches = tcPunches.filter(p => p.userId === tcUserId)
      const staffName = tcStaff.find(s => s.id === tcUserId)
      csv = `Timecard — ${staffName ? `${staffName.firstName} ${staffName.lastName}` : tcUserId}\nPeriod: ${periodLabel}\n\n`
      csv += 'Date,Day,Clock In,Clock Out,Break (min),Hours Worked,Location,Specialty\n'
      myPunches.forEach(p => {
        const d = new Date(p.punchIn)
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' })
        const inStr = formatHm(p.punchIn)
        const outStr = p.punchOut ? formatHm(p.punchOut) : 'Open'
        let breakMin = ''
        if (p.breakStart && p.breakEnd) {
          breakMin = String(Math.round((new Date(p.breakEnd).getTime() - new Date(p.breakStart).getTime()) / 60000))
        }
        const mins = minutesWorked(p)
        const hrsStr = mins !== null ? (mins / 60).toFixed(2) : ''
        const loc = p.location.name.replace(/,/g, ';')
        const spec = (p.specialty ?? '').replace(/,/g, ';')
        csv += `${dateStr},${dayStr},${inStr},${outStr},${breakMin},${hrsStr},${loc},${spec}\n`
      })
    } else {
      csv = `Timecard Summary — All Staff\nPeriod: ${periodLabel}\n\n`
      csv += 'Staff,Role,Days Worked,Total Hours,OT Hours,Tardy,Absences\n'
      const periodDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
      const otThreshold = Math.ceil((periodDays / 7) * 40 * 60) // in minutes
      tcStaff.forEach(s => {
        const sp = tcPunches.filter(p => p.userId === s.id)
        if (sp.length === 0) return
        const totalMins = sp.reduce((acc, p) => acc + (minutesWorked(p) ?? 0), 0)
        const days = new Set(sp.map(p => new Date(p.punchIn).toDateString())).size
        const otMins = Math.max(0, totalMins - otThreshold)
        const tardy = tcOccurrences.filter(o => o.userId === s.id && o.type === 'tardy').length
        const absent = tcOccurrences.filter(o => o.userId === s.id && o.type === 'unexcused_absence').length
        const role = s.role.replace('_', ' ')
        csv += `${s.firstName} ${s.lastName},${role},${days},${(totalMins/60).toFixed(2)},${otMins > 0 ? (otMins/60).toFixed(2) : '0'},${tardy},${absent}\n`
      })
    }

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timecards-${start.toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    fetchData()
    pollRef.current = setInterval(fetchData, 30000)
    tickRef.current = setInterval(() => {
      setNow(Date.now())
      setSecondsSince((s) => s + 1)
    }, 1000)

    apiFetch(`/api/locations?practiceId=${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((data: LocationItem[]) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => {})

    apiFetch(`/api/clock-adjustments?practiceId=${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((data) => setAdjustments(Array.isArray(data) ? data : []))
      .catch(() => {})

    apiFetch(`/api/practice/${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.requireSpecialty === 'boolean') setRequireSpecialty(data.requireSpecialty)
        setPracticePayroll({
          payrollPeriod: data?.payrollPeriod ?? null,
          payrollStartDay: data?.payrollStartDay ?? null,
          payrollNextDate: data?.payrollNextDate ?? null,
        })
      })
      .catch(() => {})

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  // Fetch timecards whenever view/anchor/user/payroll changes
  useEffect(() => {
    const { start, end } = getPeriodBounds(tcAnchor, tcView, practicePayroll)
    fetchTimecards(start, end)
  }, [tcAnchor, tcView, tcUserId, practicePayroll])

  function openEdit(punch: TodayPunch) {
    setEditState({
      punch,
      punchIn: toDatetimeLocal(punch.punchIn),
      punchOut: toDatetimeLocal(punch.punchOut),
      locationId: punch.locationId,
      specialty: punch.specialty ?? '',
    })
  }

  function openTcEdit(punch: RangePunch) {
    setEditState({
      punch,
      punchIn: toDatetimeLocal(punch.punchIn),
      punchOut: toDatetimeLocal(punch.punchOut),
      locationId: punch.locationId,
      specialty: punch.specialty ?? '',
      fromTimecard: true,
    })
  }

  async function reviewAdjustment(id: string, status: 'approved' | 'denied', note?: string) {
    setReviewingId(id)
    try {
      const res = await apiFetch(`/api/clock-adjustments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNotes: note?.trim() || undefined }),
      })
      if (res.ok) {
        const updated: AdjustmentRequest = await res.json()
        setAdjustments((prev) => prev.map((a) => (a.id === id ? updated : a)))
        setExpandedAdjId(null)
        setManagerNote('')
        if (status === 'approved') await fetchData()
      }
    } catch {
      // swallow
    } finally {
      setReviewingId(null)
    }
  }

  async function toggleRequireSpecialty() {
    setTogglingSpecialty(true)
    try {
      const next = !requireSpecialty
      await apiFetch(`/api/practice/${PRACTICE_ID}`, {
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
    const fromTimecard = editState.fromTimecard
    try {
      const body: Record<string, string | undefined> = {
        punchIn: editState.punchIn ? new Date(editState.punchIn).toISOString() : undefined,
        punchOut: editState.punchOut ? new Date(editState.punchOut).toISOString() : undefined,
        locationId: editState.locationId || undefined,
        specialty: editState.specialty || undefined,
      }
      Object.keys(body).forEach((k) => body[k] === undefined && delete body[k])

      await apiFetch(`/api/time-punches/${editState.punch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setEditState(null)
      await fetchData()
      if (fromTimecard && tcDateRange) {
        await fetchTimecards(tcDateRange.start, tcDateRange.end)
      }
    } catch {
      // swallow
    } finally {
      setSaving(false)
    }
  }

  // Computed timecard period
  const tcPeriod = getPeriodBounds(tcAnchor, tcView, practicePayroll)

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-[#2C3E3A]">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-[#8BAF9A] hover:text-white">← Back
            </a>
            <span className="text-[#4A5C52]">|</span>
            <h1 className="text-xl font-bold text-[#FAF6EF]">Time Clock</h1>
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
              <svg className="mb-3 h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                <path d="M12 6v6l4 2" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium">No staff currently clocked in</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {livePunches.map((p) => (
                <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                      style={{ backgroundColor: '#E1F5EE', color: '#085041' }}
                    >
                      {initials(p.user.firstName, p.user.lastName)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{p.user.firstName} {p.user.lastName}</p>
                      <p className="text-xs text-gray-400">{formatElapsed(p.punchIn, now)}</p>
                    </div>
                    <div className="ml-auto flex gap-1.5">
                      {p.isTardy && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Tardy</span>
                      )}
                      {p.breakStart && !p.breakEnd && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">On break</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{p.location.name}</span>
                    {p.specialty && (
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: '#E1F5EE', color: '#085041' }}>
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
                <tr className="border-b bg-[#EFECE4] text-xs uppercase text-[#4A5C52]">
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
                    <td colSpan={8} className="py-10 text-center text-gray-400">No punches recorded today</td>
                  </tr>
                ) : (
                  todayPunches.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F0EDE5]">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.user.firstName} {p.user.lastName}</td>
                      <td className="px-4 py-3 text-gray-600">{p.location.name}</td>
                      <td className="px-4 py-3 text-gray-600">{p.specialty ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center justify-between gap-3">
                          <span>{formatHm(p.punchIn)}</span>
                          {p.isTardy && <span className="text-xs italic text-red-600">Tardy</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.punchOut ? (
                          <span className="text-gray-600">{formatHm(p.punchOut)}</span>
                        ) : (
                          <span className="italic text-gray-400">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatBreak(p.breakStart, p.breakEnd)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDuration(p.punchIn, p.punchOut, p.breakStart, p.breakEnd, now)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(p)} className="rounded px-2.5 py-1 text-xs font-medium text-[#1D9E75] hover:bg-[#E1F5EE]">
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

        {/* Adjustment requests */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Adjustment Requests
              {adjustments.filter((a) => a.status === 'pending').length > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {adjustments.filter((a) => a.status === 'pending').length} pending
                </span>
              )}
            </h2>
            <div className="flex gap-1">
              {(['pending', 'all', 'approved', 'denied'] as const).map((f) => (
                <button key={f} onClick={() => setAdjFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    adjFilter === f ? 'bg-[#1D9E75] text-white' : 'bg-[#E8E4DB] text-[#4A5C52] hover:bg-[#DDD9D0]'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {adjustments.filter((a) => adjFilter === 'all' || a.status === adjFilter).length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No {adjFilter === 'all' ? '' : adjFilter} requests</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {adjustments
                  .filter((a) => adjFilter === 'all' || a.status === adjFilter)
                  .map((a) => {
                    const isExpanded = expandedAdjId === a.id
                    const hasCorrectedTimes = a.correctedPunchIn || a.correctedPunchOut
                    return (
                      <div key={a.id} className={isExpanded ? 'bg-amber-50' : ''}>
                        <div className="flex items-center gap-4 px-5 py-3.5">
                          <div className="w-40 shrink-0">
                            <p className="text-sm font-semibold text-gray-900">{a.user.firstName} {a.user.lastName}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="w-32 shrink-0">
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              {ADJUSTMENT_TYPE_LABELS[a.type] ?? a.type}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            {hasCorrectedTimes ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                {a.correctedPunchIn && (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#E8F5F0] border border-[#A7F3D0] px-2.5 py-1 text-xs font-semibold text-[#065F46]">
                                    In → {formatHm(a.correctedPunchIn)}
                                  </span>
                                )}
                                {a.correctedPunchOut && (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#E8F5F0] border border-[#A7F3D0] px-2.5 py-1 text-xs font-semibold text-[#065F46]">
                                    Out → {formatHm(a.correctedPunchOut)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 truncate">{a.notes}</p>
                            )}
                            {hasCorrectedTimes && a.notes && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{a.notes}</p>
                            )}
                          </div>
                          <div className="w-24 shrink-0 text-right hidden lg:block">
                            <p className="text-xs text-gray-400">
                              {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <div className="w-24 shrink-0">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              a.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              a.status === 'approved' ? 'bg-green-100 text-green-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                            </span>
                          </div>
                          <div className="shrink-0">
                            {a.status === 'pending' ? (
                              <button
                                onClick={() => { setExpandedAdjId(isExpanded ? null : a.id); setManagerNote('') }}
                                className="rounded-lg bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                              >
                                Review
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>
                        </div>

                        {isExpanded && a.status === 'pending' && (
                          <div className="mx-5 mb-4 rounded-xl border border-amber-200 bg-white p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-bold text-gray-800">Review — {a.user.firstName} {a.user.lastName}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {ADJUSTMENT_TYPE_LABELS[a.type] ?? a.type} · {new Date(a.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            {hasCorrectedTimes && (
                              <div className="rounded-lg bg-[#F0FAF6] border border-[#A7F3D0] px-4 py-3">
                                <p className="text-xs font-semibold text-[#065F46] mb-1.5">
                                  {a.punchId ? 'Approving will update the time punch:' : 'Corrected times requested:'}
                                </p>
                                <div className="flex flex-wrap gap-3">
                                  {a.correctedPunchIn && (
                                    <div>
                                      <span className="text-xs text-gray-500">Clock In →</span>
                                      <span className="ml-1.5 text-sm font-bold text-[#1D9E75]">{formatHm(a.correctedPunchIn)}</span>
                                    </div>
                                  )}
                                  {a.correctedPunchOut && (
                                    <div>
                                      <span className="text-xs text-gray-500">Clock Out →</span>
                                      <span className="ml-1.5 text-sm font-bold text-[#1D9E75]">{formatHm(a.correctedPunchOut)}</span>
                                    </div>
                                  )}
                                </div>
                                {!a.punchId && (
                                  <p className="text-xs text-amber-600 mt-1.5">No linked punch — you may need to add the entry manually in today's log.</p>
                                )}
                              </div>
                            )}
                            {a.notes && (
                              <div className="rounded-lg bg-gray-50 px-3 py-2">
                                <p className="text-xs text-gray-400 font-medium mb-0.5">Staff note:</p>
                                <p className="text-sm text-gray-700">{a.notes}</p>
                              </div>
                            )}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Manager Notes <span className="text-gray-400 font-normal">(optional)</span>
                              </label>
                              <input
                                type="text"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                                placeholder="Add a note for the employee…"
                                value={managerNote}
                                onChange={e => setManagerNote(e.target.value)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setExpandedAdjId(null); setManagerNote('') }}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-[#F0EDE5]">
                                Cancel
                              </button>
                              <button onClick={() => reviewAdjustment(a.id, 'denied', managerNote)} disabled={reviewingId === a.id}
                                className="flex-1 rounded-lg border border-red-300 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                                {reviewingId === a.id ? '…' : 'Deny'}
                              </button>
                              <button onClick={() => reviewAdjustment(a.id, 'approved', managerNote)} disabled={reviewingId === a.id}
                                className="flex-1 rounded-lg bg-[#1D9E75] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                                {reviewingId === a.id ? 'Applying…' : hasCorrectedTimes && a.punchId ? '✓ Approve & Update Timesheet' : '✓ Approve'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </section>

        {/* ── Timecards ── */}
        <section className="pb-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-800">Timecards &amp; Reports</h2>
              {tcLoading && <span className="text-xs text-gray-400 animate-pulse">Loading…</span>}
            </div>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 rounded-lg border border-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-[#1D9E75] hover:bg-[#E1F5EE] transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>

          {/* Period type tabs */}
          <div className="flex gap-1.5 mb-4">
            {(['payperiod', 'weekly', 'monthly', 'yearly'] as const).map((v) => (
              <button key={v}
                onClick={() => { setTcView(v); const d = new Date(); d.setHours(0,0,0,0); setTcAnchor(d) }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  tcView === v ? 'bg-[#1D9E75] text-white' : 'bg-[#E8E4DB] text-[#4A5C52] hover:bg-[#DDD9D0]'
                }`}
              >
                {v === 'payperiod' ? 'Pay Period' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Navigator + staff selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTcAnchor(a => {
                  const d = new Date(getPeriodBounds(a, tcView, practicePayroll).start)
                  d.setDate(d.getDate() - 1)
                  return d
                })}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8E4DB] text-[#4A5C52] hover:bg-[#DDD9D0] text-base font-bold leading-none"
              >
                ‹
              </button>
              <span className="min-w-[220px] text-center text-sm font-semibold text-gray-800">
                {tcPeriod.label}
              </span>
              <button
                onClick={() => setTcAnchor(a => {
                  const d = new Date(getPeriodBounds(a, tcView, practicePayroll).end)
                  d.setDate(d.getDate() + 1)
                  return d
                })}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8E4DB] text-[#4A5C52] hover:bg-[#DDD9D0] text-base font-bold leading-none"
              >
                ›
              </button>
            </div>

            <div className="flex items-center gap-2">
              {tcUserId && (
                <button onClick={() => setTcUserId('')}
                  className="text-xs text-[#1D9E75] underline hover:opacity-80">
                  ← All Staff
                </button>
              )}
              <select
                value={tcUserId}
                onChange={e => setTcUserId(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              >
                <option value="">All Staff</option>
                {tcStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary stat cards */}
          {(() => {
            const periodDays = Math.round((tcPeriod.end.getTime() - tcPeriod.start.getTime()) / 86400000) + 1
            const otThresholdMins = Math.ceil((periodDays / 7) * 40 * 60)

            const relevantPunches = tcUserId ? tcPunches.filter(p => p.userId === tcUserId) : tcPunches
            const totalMins = relevantPunches.reduce((acc, p) => acc + (minutesWorked(p) ?? 0), 0)
            const staffCount = tcUserId ? 1 : new Set(relevantPunches.map(p => p.userId)).size
            const openCount = relevantPunches.filter(p => !p.punchOut).length
            const otStaff = tcUserId ? 0 : (() => {
              const byUser = new Map<string, number>()
              relevantPunches.forEach(p => {
                const m = minutesWorked(p) ?? 0
                byUser.set(p.userId, (byUser.get(p.userId) ?? 0) + m)
              })
              return Array.from(byUser.values()).filter(m => m > otThresholdMins).length
            })()
            const avgMins = staffCount > 0 ? Math.round(totalMins / staffCount) : 0

            const cards = tcUserId
              ? [
                  { label: 'Total Hours', value: totalMins > 0 ? formatHrs(totalMins) : '—', sub: `${periodDays}-day period`, color: 'text-[#1D9E75]' },
                  { label: 'Days Worked', value: String(new Set(relevantPunches.filter(p => p.punchOut).map(p => new Date(p.punchIn).toDateString())).size), sub: 'with clock-out', color: 'text-gray-800' },
                  { label: 'Avg Per Day', value: (() => { const d = new Set(relevantPunches.filter(p => p.punchOut).map(p => new Date(p.punchIn).toDateString())).size; return d > 0 ? formatHrs(Math.round(totalMins / d)) : '—' })(), sub: 'when worked', color: 'text-gray-800' },
                  { label: 'Open Punches', value: String(openCount), sub: openCount > 0 ? 'missing clock-out' : 'all complete', color: openCount > 0 ? 'text-amber-600' : 'text-gray-400' },
                ]
              : [
                  { label: 'Total Hours', value: totalMins > 0 ? formatHrs(totalMins) : '—', sub: 'all staff combined', color: 'text-[#1D9E75]' },
                  { label: 'Staff Worked', value: String(staffCount), sub: 'in this period', color: 'text-gray-800' },
                  { label: 'Avg Per Staff', value: avgMins > 0 ? formatHrs(avgMins) : '—', sub: 'total ÷ staff', color: 'text-gray-800' },
                  { label: openCount > 0 ? 'Open Punches' : otStaff > 0 ? 'OT Flagged' : 'Issues', value: String(openCount > 0 ? openCount : otStaff), sub: openCount > 0 ? 'missing clock-out' : otStaff > 0 ? `over ${formatHrs(otThresholdMins)} threshold` : 'none this period', color: (openCount > 0 || otStaff > 0) ? 'text-amber-600' : 'text-gray-400' },
                ]

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {cards.map((c, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                    <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Individual view — day-by-day */}
          {tcUserId ? (() => {
            const myPunches = tcPunches.filter(p => p.userId === tcUserId)

            // Yearly: month-by-month summary
            if (tcView === 'yearly') {
              const months = Array.from({ length: 12 }, (_, m) => {
                const ps = myPunches.filter(p => new Date(p.punchIn).getMonth() === m)
                const mins = ps.reduce((acc, p) => acc + (minutesWorked(p) ?? 0), 0)
                return {
                  label: new Date(tcPeriod.start.getFullYear(), m, 1).toLocaleString('en-US', { month: 'long' }),
                  mins,
                  days: new Set(ps.map(p => new Date(p.punchIn).toDateString())).size,
                  open: ps.filter(p => !p.punchOut).length,
                }
              })
              const totalMins = months.reduce((a, m) => a + m.mins, 0)

              return (
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b bg-[#EFECE4] text-xs uppercase text-[#4A5C52]">
                        <th className="px-4 py-3 text-left font-semibold">Month</th>
                        <th className="px-4 py-3 text-center font-semibold">Days Worked</th>
                        <th className="px-4 py-3 text-center font-semibold">Total Hours</th>
                        <th className="px-4 py-3 text-center font-semibold">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {months.map((m, i) => (
                        <tr key={i} className={`hover:bg-[#F0EDE5] ${m.mins === 0 && m.open === 0 ? 'opacity-40' : ''}`}>
                          <td className="px-4 py-2.5 font-medium text-gray-800">{m.label}</td>
                          <td className="px-4 py-2.5 text-center text-gray-600">{m.days || '—'}</td>
                          <td className="px-4 py-2.5 text-center font-medium text-gray-700">{m.mins > 0 ? formatHrs(m.mins) : '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            {m.open > 0 && <span className="text-xs text-amber-600 font-medium">{m.open} open</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-[#F5F0E8]">
                        <td colSpan={2} className="px-4 py-2.5 text-xs font-bold uppercase text-gray-600">Year Total</td>
                        <td className="px-4 py-2.5 text-center font-bold text-[#1D9E75]">{totalMins > 0 ? formatHrs(totalMins) : '—'}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            }

            // Day-by-day view
            const days = getDaysInRange(tcPeriod.start, tcPeriod.end)
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const punchByDay = new Map<string, RangePunch[]>()
            myPunches.forEach(p => {
              const key = new Date(p.punchIn).toDateString()
              const arr = punchByDay.get(key) ?? []
              arr.push(p)
              punchByDay.set(key, arr)
            })

            const visibleDays = days.filter(d =>
              !isWeekend(d) || (punchByDay.get(d.toDateString())?.length ?? 0) > 0
            )

            // Pre-compute totals
            const totalMins = myPunches.reduce((acc, p) => acc + (minutesWorked(p) ?? 0), 0)
            const workedDays = new Set(myPunches.filter(p => p.punchOut).map(p => new Date(p.punchIn).toDateString())).size

            return (
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[#EFECE4] text-xs uppercase text-[#4A5C52]">
                      <th className="px-4 py-3 text-left font-semibold w-36">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Clock In</th>
                      <th className="px-4 py-3 text-left font-semibold">Clock Out</th>
                      <th className="px-4 py-3 text-left font-semibold">Break</th>
                      <th className="px-4 py-3 text-center font-semibold">Hours</th>
                      <th className="px-4 py-3 text-left font-semibold">Location</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleDays.map((d, di) => {
                      const key = d.toDateString()
                      const punches = punchByDay.get(key) ?? []
                      const isPast = d < today
                      const isToday = d.toDateString() === today.toDateString()
                      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

                      if (punches.length === 0) {
                        return (
                          <tr key={di} className={isWeekend(d) ? 'bg-gray-50' : ''}>
                            <td className="px-4 py-2.5 text-xs text-gray-500">
                              {dayLabel}
                              {isToday && <span className="ml-1 text-[#1D9E75] font-semibold">Today</span>}
                            </td>
                            <td colSpan={5} className={`px-4 py-2.5 text-xs italic ${isPast && !isWeekend(d) ? 'text-amber-500' : 'text-gray-300'}`}>
                              {isPast && !isWeekend(d) ? 'No punch recorded' : '—'}
                            </td>
                            <td />
                          </tr>
                        )
                      }

                      return punches.map((p, pi) => (
                        <tr key={p.id} className={`hover:bg-[#F0EDE5] ${isToday ? 'bg-[#F0FAF6]' : ''}`}>
                          {pi === 0 && (
                            <td className="px-4 py-2.5 text-xs text-gray-600 font-medium align-top" rowSpan={punches.length}>
                              {dayLabel}
                              {isToday && <span className="ml-1 text-[#1D9E75] font-semibold">Today</span>}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-gray-700">{formatHm(p.punchIn)}</td>
                          <td className="px-4 py-2.5">
                            {p.punchOut
                              ? <span className="text-gray-700">{formatHm(p.punchOut)}</span>
                              : <span className="text-amber-500 italic text-xs">Open</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{formatBreak(p.breakStart, p.breakEnd)}</td>
                          <td className="px-4 py-2.5 text-center font-medium text-gray-800">
                            {(() => {
                              const m = minutesWorked(p)
                              return m !== null ? formatHrs(m) : <span className="text-amber-500 text-xs italic">Open</span>
                            })()}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{p.location.name}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => openTcEdit(p)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-[#1D9E75] hover:bg-[#E1F5EE]">
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-[#F5F0E8]">
                      <td colSpan={4} className="px-4 py-2.5 text-xs font-bold uppercase text-gray-600">
                        {workedDays} day{workedDays !== 1 ? 's' : ''} worked
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#1D9E75] text-base">
                        {totalMins > 0 ? formatHrs(totalMins) : '—'}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })() : (() => {
            // All-staff summary with OT, tardy, and absence reporting
            const periodDays = Math.round((tcPeriod.end.getTime() - tcPeriod.start.getTime()) / 86400000) + 1
            const otThresholdMins = Math.ceil((periodDays / 7) * 40 * 60)

            const staffRows = tcStaff.map(s => {
              const sp = tcPunches.filter(p => p.userId === s.id)
              const totalMins = sp.reduce((acc, p) => acc + (minutesWorked(p) ?? 0), 0)
              const days = new Set(sp.map(p => new Date(p.punchIn).toDateString())).size
              const openPunches = sp.filter(p => !p.punchOut).length
              const otMins = Math.max(0, totalMins - otThresholdMins)
              const tardy = tcOccurrences.filter(o => o.userId === s.id && o.type === 'tardy').length
              const absent = tcOccurrences.filter(o => o.userId === s.id && o.type === 'unexcused_absence').length
              return { ...s, totalMins, days, openPunches, otMins, tardy, absent, punchCount: sp.length }
            }).filter(s => s.punchCount > 0)

            if (staffRows.length === 0 && !tcLoading) {
              return (
                <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-12 text-gray-400">
                  <p className="text-sm font-medium">No punches recorded for this period</p>
                  <p className="text-xs mt-1">Adjust the date range or check that staff have clocked in</p>
                </div>
              )
            }

            const grandTotal = staffRows.reduce((a, s) => a + s.totalMins, 0)
            const grandOT = staffRows.reduce((a, s) => a + s.otMins, 0)
            const totalTardy = staffRows.reduce((a, s) => a + s.tardy, 0)
            const totalAbsent = staffRows.reduce((a, s) => a + s.absent, 0)

            return (
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[#EFECE4] text-xs uppercase text-[#4A5C52]">
                      <th className="px-4 py-3 text-left font-semibold">Staff Member</th>
                      <th className="px-4 py-3 text-center font-semibold">Days</th>
                      <th className="px-4 py-3 text-center font-semibold">Reg Hours</th>
                      <th className="px-4 py-3 text-center font-semibold">OT</th>
                      <th className="px-4 py-3 text-center font-semibold">Tardy</th>
                      <th className="px-4 py-3 text-center font-semibold">Absent</th>
                      <th className="px-4 py-3 text-center font-semibold">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {staffRows.map(s => {
                      const regMins = Math.min(s.totalMins, otThresholdMins)
                      const clean = s.openPunches === 0 && s.tardy === 0 && s.absent === 0 && s.otMins === 0
                      return (
                        <tr key={s.id} className="hover:bg-[#F0EDE5] cursor-pointer" onClick={() => setTcUserId(s.id)}>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <span>{s.firstName} {s.lastName}</span>
                            <span className="ml-2 text-xs text-gray-400 font-normal capitalize">{s.role.replace('_', ' ')}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">{s.days}</td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-800">
                            {regMins > 0 ? formatHrs(regMins) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {s.otMins > 0
                              ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">+{formatHrs(s.otMins)}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {s.tardy > 0
                              ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{s.tardy}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {s.absent > 0
                              ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{s.absent}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {s.openPunches > 0
                              ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 font-medium">{s.openPunches} open</span>
                              : clean
                                ? <span className="text-xs text-[#1D9E75] font-semibold">✓ OK</span>
                                : null}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={e => { e.stopPropagation(); setTcUserId(s.id) }}
                              className="rounded px-2.5 py-1 text-xs font-medium text-[#1D9E75] hover:bg-[#E1F5EE]">
                              View →
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {staffRows.length > 1 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-[#F5F0E8]">
                        <td className="px-4 py-2.5 text-xs font-bold uppercase text-gray-600">
                          {staffRows.length} staff members
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">
                          {staffRows.reduce((a,s) => a + s.days, 0)} days
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-[#1D9E75]">
                          {formatHrs(grandTotal > grandOT ? grandTotal - grandOT : grandTotal)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {grandOT > 0 && <span className="text-xs font-bold text-orange-700">+{formatHrs(grandOT)}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs font-bold text-red-700">{totalTardy || '—'}</td>
                        <td className="px-4 py-2.5 text-center text-xs font-bold text-red-700">{totalAbsent || '—'}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )
          })()}
        </section>
      </main>

      {/* Edit modal — shared between Today's punches and Timecards */}
      {editState && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50 }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditState(null) }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-5 text-base font-semibold text-gray-900">
              Edit punch — {editState.punch.user.firstName} {editState.punch.user.lastName}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Clock In</label>
                <input type="datetime-local"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={editState.punchIn}
                  onChange={(e) => setEditState((s) => s ? { ...s, punchIn: e.target.value } : s)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Clock Out <span className="text-gray-400">(optional)</span>
                </label>
                <input type="datetime-local"
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
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
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
                  {SPECIALTIES.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setEditState(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-[#F0EDE5]">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 rounded-lg bg-[#1D9E75] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
