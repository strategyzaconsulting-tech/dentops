import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/apiFetch'

const SPECIALTIES = [
  'General Dentistry', 'Orthodontics', 'Periodontics',
  'Endodontics', 'Oral Surgery', 'Hygiene', 'Front Desk',
]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const ROLE_TABS = [
  { key: 'all',       label: 'All Staff' },
  { key: 'doctor',    label: 'Doctors'   },
  { key: 'hygienist', label: 'Hygienists'},
  { key: 'staff',     label: 'Staff'     },
  { key: 'front_desk',label: 'Front Desk'},
  { key: 'manager',   label: 'Managers'  },
]

const TEMPLATE_STORAGE_KEY = 'dentops_shift_templates'

interface StaffMember {
  id: string
  firstName: string
  lastName: string
  role: string
  status: string
}

interface Location {
  id: string
  name: string
}

interface Shift {
  id: string
  userId: string
  locationId: string
  date: string
  startTime: string
  endTime: string
  specialty: string | null
  notes: string | null
  user: { id: string; firstName: string; lastName: string }
  location: { id: string; name: string }
}

interface ShiftForm {
  userId: string
  locationId: string
  startTime: string
  endTime: string
  specialty: string
  notes: string
}

interface ShiftTemplate {
  id: string
  name: string
  startTime: string
  endTime: string
  locationId: string
  specialty: string
}

const emptyForm: ShiftForm = {
  userId: '',
  locationId: '',
  startTime: '09:00',
  endTime: '17:00',
  specialty: '',
  notes: '',
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

function formatMonthDay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.getDate()}, ${sunday.getFullYear()}`
  }
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}, ${sunday.getFullYear()}`
}

function avatarColor(id: string) {
  const palette = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % palette.length
  return palette[h]
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`
}

function buildGcalUrl(shift: Shift, staffName: string): string {
  const d = shift.date.split('T')[0].replace(/-/g, '')
  const start = shift.startTime.replace(':', '') + '00'
  const end = shift.endTime.replace(':', '') + '00'
  const details = [
    shift.specialty && `Specialty: ${shift.specialty}`,
    shift.notes && `Notes: ${shift.notes}`,
  ].filter(Boolean).join('\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${staffName} – Work Shift`,
    dates: `${d}T${start}/${d}T${end}`,
    location: shift.location.name,
  })
  if (details) params.set('details', details)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60 * 10) / 10
}

function loadTemplates(): ShiftTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveTemplates(t: ShiftTemplate[]) {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(t))
}

interface LunchConfig {
  enabled: boolean
  minutes: number
  windowStart: string
  windowEnd: string
}

type ModalState =
  | { mode: 'add'; date: string; userId: string }
  | { mode: 'edit'; shift: Shift }
  | null

export default function Schedules() {
  const { user, activePracticeId } = useAuth()
  const PRACTICE_ID = activePracticeId
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()))
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [form, setForm] = useState<ShiftForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copying, setCopying] = useState(false)
  const [roleFilter, setRoleFilter] = useState('all')
  const [showUnscheduledOnly, setShowUnscheduledOnly] = useState(false)
  const [viewMode, setViewMode] = useState<'staff' | 'location'>('staff')
  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none')
  const [repeatCount, setRepeatCount] = useState(4)
  const [lunchConfig, setLunchConfig] = useState<LunchConfig>({
    enabled: false, minutes: 60, windowStart: '13:00', windowEnd: '14:00',
  })
  const [templates, setTemplates] = useState<ShiftTemplate[]>(() => loadTemplates())
  const [newTemplateName, setNewTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday]
  )

  const weekStart = dateKey(monday)

  async function fetchAll() {
    setLoading(true)
    try {
      const [staffRes, locRes, shiftRes, practiceRes] = await Promise.all([
        apiFetch(`/api/staff?practiceId=${PRACTICE_ID}`),
        apiFetch(`/api/locations?practiceId=${PRACTICE_ID}`),
        apiFetch(`/api/shifts?practiceId=${PRACTICE_ID}&weekStart=${weekStart}`),
        apiFetch(`/api/practice/${PRACTICE_ID}`),
      ])
      const [staffData, locData, shiftData, practiceData] = await Promise.all([
        staffRes.json(), locRes.json(), shiftRes.json(), practiceRes.json(),
      ])
      setStaff(Array.isArray(staffData) ? staffData.filter((s: StaffMember) => s.status !== 'inactive') : [])
      setLocations(Array.isArray(locData) ? locData : [])
      setShifts(Array.isArray(shiftData) ? shiftData : [])
      if (practiceData && typeof practiceData === 'object') {
        setLunchConfig({
          enabled: practiceData.lunchBreakEnabled ?? false,
          minutes: practiceData.lunchBreakMinutes ?? 60,
          windowStart: practiceData.lunchBreakWindowStart ?? '13:00',
          windowEnd: practiceData.lunchBreakWindowEnd ?? '14:00',
        })
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [weekStart])

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const s of shifts) {
      const key = `${s.userId}__${s.date.split('T')[0]}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [shifts])

  // Weekly hours per staff member, optionally deducting a configured lunch break
  const hoursMap = useMemo(() => {
    const roleMap = new Map(staff.map(s => [s.id, s.role]))
    const map = new Map<string, number>()
    const [wsh, wsm] = lunchConfig.windowStart.split(':').map(Number)
    const [weh, wem] = lunchConfig.windowEnd.split(':').map(Number)
    const windowStartMins = wsh * 60 + wsm
    const windowEndMins = weh * 60 + wem
    for (const s of shifts) {
      let h = calcHours(s.startTime, s.endTime)
      if (lunchConfig.enabled && roleMap.get(s.userId) !== 'doctor') {
        const [sh, sm] = s.startTime.split(':').map(Number)
        const [eh, em] = s.endTime.split(':').map(Number)
        if (sh * 60 + sm <= windowStartMins && eh * 60 + em >= windowEndMins) {
          h -= lunchConfig.minutes / 60
        }
      }
      map.set(s.userId, (map.get(s.userId) ?? 0) + h)
    }
    return map
  }, [shifts, staff, lunchConfig])

  const filteredStaff = useMemo(() => {
    let result = roleFilter === 'all' ? staff : staff.filter(s => s.role === roleFilter)
    if (showUnscheduledOnly) result = result.filter(s => !hoursMap.has(s.id))
    return result
  }, [staff, roleFilter, showUnscheduledOnly, hoursMap])

  function openAdd(userId: string, date: string, defaultLocationId?: string) {
    setForm({ ...emptyForm, userId, locationId: defaultLocationId ?? locations[0]?.id ?? '' })
    setModal({ mode: 'add', date, userId })
    setRecurrence('none')
    setRepeatCount(4)
    setShowSaveTemplate(false)
    setNewTemplateName('')
  }

  function openEdit(shift: Shift) {
    setForm({
      userId: shift.userId,
      locationId: shift.locationId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      specialty: shift.specialty ?? '',
      notes: shift.notes ?? '',
    })
    setModal({ mode: 'edit', shift })
    setShowSaveTemplate(false)
    setNewTemplateName('')
  }

  function applyTemplate(t: ShiftTemplate) {
    setForm(f => ({
      ...f,
      startTime: t.startTime,
      endTime: t.endTime,
      locationId: t.locationId || f.locationId,
      specialty: t.specialty || f.specialty,
    }))
  }

  function handleSaveTemplate() {
    if (!newTemplateName.trim()) return
    const t: ShiftTemplate = {
      id: crypto.randomUUID(),
      name: newTemplateName.trim(),
      startTime: form.startTime,
      endTime: form.endTime,
      locationId: form.locationId,
      specialty: form.specialty,
    }
    const updated = [...templates, t]
    setTemplates(updated)
    saveTemplates(updated)
    setNewTemplateName('')
    setShowSaveTemplate(false)
  }

  function deleteTemplate(id: string) {
    const updated = templates.filter(t => t.id !== id)
    setTemplates(updated)
    saveTemplates(updated)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (modal?.mode === 'add') {
        const dates: string[] = [modal.date]
        if (recurrence !== 'none') {
          const base = new Date(modal.date + 'T12:00:00')
          for (let i = 1; i < repeatCount; i++) {
            let next: Date
            if (recurrence === 'monthly') {
              next = new Date(base.getFullYear(), base.getMonth() + i, base.getDate())
            } else {
              const intervalDays = recurrence === 'weekly' ? 7 : 14
              next = addDays(base, intervalDays * i)
            }
            dates.push(dateKey(next))
          }
        }
        await Promise.all(dates.map(date =>
          apiFetch(`/api/shifts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              practiceId: PRACTICE_ID,
              userId: form.userId,
              locationId: form.locationId,
              date,
              startTime: form.startTime,
              endTime: form.endTime,
              specialty: form.specialty || undefined,
              notes: form.notes || undefined,
            }),
          })
        ))
      } else if (modal?.mode === 'edit') {
        await apiFetch(`/api/shifts/${modal.shift.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationId: form.locationId,
            startTime: form.startTime,
            endTime: form.endTime,
            specialty: form.specialty || undefined,
            notes: form.notes || undefined,
          }),
        })
      }
      setModal(null)
      await fetchAll()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (modal?.mode !== 'edit') return
    setDeleting(true)
    try {
      await apiFetch(`/api/shifts/${modal.shift.id}`, { method: 'DELETE' })
      setModal(null)
      await fetchAll()
    } finally {
      setDeleting(false)
    }
  }

  async function handleCopyWeek() {
    if (shifts.length === 0) return
    setCopying(true)
    try {
      await Promise.allSettled(
        shifts.map(s => {
          const nextDate = dateKey(addDays(new Date(s.date.split('T')[0] + 'T12:00:00'), 7))
          return apiFetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              practiceId: PRACTICE_ID,
              userId: s.userId,
              locationId: s.locationId,
              date: nextDate,
              startTime: s.startTime,
              endTime: s.endTime,
              specialty: s.specialty || undefined,
              notes: s.notes || undefined,
            }),
          })
        })
      )
      setMonday(m => addDays(m, 7))
    } finally {
      setCopying(false)
    }
  }

  const canSave = form.locationId && form.startTime && form.endTime && form.userId

  const modalStaffMember = modal
    ? staff.find(s => s.id === (modal.mode === 'add' ? modal.userId : modal.shift.userId))
    : null

  const totalScheduled = filteredStaff.reduce((sum, m) => {
    const h = hoursMap.get(m.id) ?? 0
    return sum + h
  }, 0)

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1.2cm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          [data-no-print] { display: none !important; }
          [data-print-only] { display: block !important; }
          .sticky { position: static !important; }
          .overflow-x-auto { overflow: visible !important; }
          .shadow-sm, .shadow-xl { box-shadow: none !important; }
          .min-h-screen { min-height: unset !important; }
          main.container { padding-top: 0.5rem !important; }
        }
      `}</style>

      {/* Print-only header */}
      <div data-print-only style={{ display: 'none' }} className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Weekly Schedule</h1>
        <p className="text-sm text-gray-500">{formatWeekRange(monday)}</p>
      </div>

      {/* Header */}
      <header data-no-print className="bg-[#2C3E3A]">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <a href="/" className="text-sm text-[#8BAF9A] hover:text-white">← Back</a>
            <span className="text-[#4A5C52]">|</span>
            <h1 className="text-xl font-bold text-[#FAF6EF]">Schedules</h1>
          </div>

          {/* Week navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonday(m => addDays(m, -7))}
              className="rounded-lg border border-[#3D5450] px-3 py-1.5 text-sm text-gray-300 hover:bg-[#3D5450]"
            >←</button>
            <span className="min-w-[180px] text-center text-sm font-semibold text-gray-200">
              {formatWeekRange(monday)}
            </span>
            <button
              onClick={() => setMonday(m => addDays(m, 7))}
              className="rounded-lg border border-[#3D5450] px-3 py-1.5 text-sm text-gray-300 hover:bg-[#3D5450]"
            >→</button>
            <button
              onClick={() => setMonday(getMonday(new Date()))}
              className="rounded-lg border border-[#3D5450] px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-[#3D5450]"
            >Today</button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyWeek}
              disabled={copying || shifts.length === 0}
              title="Copy this week's shifts to next week"
              className="flex items-center gap-1.5 rounded-lg border border-[#3D5450] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-[#3D5450] disabled:opacity-40"
            >
              {copying ? 'Copying…' : '⇉ Copy Week →'}
            </button>
            <button
              onClick={() => window.print()}
              title="Export schedule as PDF"
              className="flex items-center gap-1.5 rounded-lg border border-[#3D5450] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-[#3D5450]"
            >
              ↓ Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Role filter tabs + summary bar */}
      <div data-no-print className="border-b border-gray-200 bg-white shadow-sm">
        <div className="container flex items-center justify-between">
          <div className="flex">
            {ROLE_TABS.map(tab => {
              const count = tab.key === 'all'
                ? staff.length
                : staff.filter(s => s.role === tab.key).length
              if (count === 0 && tab.key !== 'all') return null
              return (
                <button
                  key={tab.key}
                  onClick={() => setRoleFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                    roleFilter === tab.key
                      ? 'border-[#1D9E75] text-[#1D9E75]'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0 text-xs font-bold leading-5 ${
                    roleFilter === tab.key ? 'bg-[#E8F5F0] text-[#1D9E75]' : 'bg-gray-100 text-gray-400'
                  }`}>{count}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3 pr-1">
            {/* Unscheduled filter */}
            {!loading && (
              <button
                onClick={() => setShowUnscheduledOnly(v => !v)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                  showUnscheduledOnly
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${showUnscheduledOnly ? 'bg-amber-400' : 'bg-gray-300'}`} />
                Unscheduled
                {!showUnscheduledOnly && (
                  <span className="ml-0.5 font-bold text-gray-500">
                    {staff.filter(s => !hoursMap.has(s.id)).length}
                  </span>
                )}
              </button>
            )}
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setViewMode('staff')}
                className={`px-3 py-1.5 transition-colors ${viewMode === 'staff' ? 'bg-[#1D9E75] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >By Staff</button>
              <button
                onClick={() => setViewMode('location')}
                className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${viewMode === 'location' ? 'bg-[#1D9E75] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >By Location</button>
            </div>
            {!loading && filteredStaff.length > 0 && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span><span className="font-semibold text-gray-800">{filteredStaff.length}</span> staff</span>
                <span><span className="font-semibold text-gray-800">{totalScheduled.toFixed(1)}</span> hrs this week</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="container py-6">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
        ) : staff.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">
            No active staff.{' '}
            <a href="/staff" className="text-[#1D9E75] hover:underline">Add staff first →</a>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">No staff in this role group.</div>
        ) : viewMode === 'location' ? (
          /* ── By-Location view ── */
          <div className="space-y-6">
            {locations.map(loc => {
              const locShifts = shifts.filter(s => s.locationId === loc.id)
              const locStaffIds = new Set(locShifts.map(s => s.userId))
              const locStaff = filteredStaff.filter(s => locStaffIds.has(s.id))
              const locShiftMap = new Map<string, Shift[]>()
              for (const s of locShifts) {
                const key = `${s.userId}__${s.date.split('T')[0]}`
                if (!locShiftMap.has(key)) locShiftMap.set(key, [])
                locShiftMap.get(key)!.push(s)
              }
              const locHoursMap = new Map<string, number>()
              for (const s of locShifts) {
                let h = calcHours(s.startTime, s.endTime)
                const [wsh, wsm] = lunchConfig.windowStart.split(':').map(Number)
                const [weh, wem] = lunchConfig.windowEnd.split(':').map(Number)
                const wStart = wsh * 60 + wsm, wEnd = weh * 60 + wem
                if (lunchConfig.enabled) {
                  const [sh, sm] = s.startTime.split(':').map(Number)
                  const [eh, em] = s.endTime.split(':').map(Number)
                  const staffRole = staff.find(m => m.id === s.userId)?.role
                  if (staffRole !== 'doctor' && sh * 60 + sm <= wStart && eh * 60 + em >= wEnd)
                    h -= lunchConfig.minutes / 60
                }
                locHoursMap.set(s.userId, (locHoursMap.get(s.userId) ?? 0) + h)
              }
              return (
                <div key={loc.id}>
                  <div className="flex items-center gap-3 mb-2 px-1">
                    <h2 className="text-sm font-bold text-gray-700">{loc.name}</h2>
                    <span className="text-xs text-gray-400">{locStaff.length} staff · {[...locHoursMap.values()].reduce((a, b) => a + b, 0).toFixed(1)} hrs</span>
                  </div>
                  {locStaff.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-400">
                      No shifts scheduled at {loc.name} this week.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-[#EFECE4]">
                            <th className="sticky left-0 z-20 w-52 border-r border-gray-200 bg-[#EFECE4] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Staff</th>
                            {weekDays.map((day, i) => {
                              const isToday = dateKey(day) === dateKey(new Date())
                              return (
                                <th key={i} className={`min-w-[130px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-[#1D9E75]' : 'text-gray-500'}`}>
                                  <div>{DAY_LABELS[i]}</div>
                                  <div className={`mt-0.5 text-base font-bold ${isToday ? 'text-[#1D9E75]' : 'text-gray-700'}`}>{formatMonthDay(day)}</div>
                                </th>
                              )
                            })}
                            <th className="w-20 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Hrs</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {locStaff.map(member => {
                            const hrs = locHoursMap.get(member.id) ?? 0
                            return (
                              <tr key={member.id} className="group hover:bg-[#F7F5F0]">
                                <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-4 py-3 group-hover:bg-[#F7F5F0]">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: avatarColor(member.id) }}>
                                      {`${member.firstName[0]}${member.lastName[0]}`.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{member.firstName} {member.lastName}</p>
                                      <p className="text-xs text-gray-400 capitalize leading-tight">{member.role.replace('_', ' ')}</p>
                                    </div>
                                  </div>
                                </td>
                                {weekDays.map((day, i) => {
                                  const key = `${member.id}__${dateKey(day)}`
                                  const dayShifts = locShiftMap.get(key) ?? []
                                  const isToday = dateKey(day) === dateKey(new Date())
                                  return (
                                    <td key={i} className={`min-w-[130px] px-2 py-2 align-top ${isToday ? 'bg-[#F0FBF6]' : ''}`}>
                                      <div className="space-y-1">
                                        {dayShifts.map(shift => (
                                          <div key={shift.id} className="group/card relative">
                                            <button onClick={() => openEdit(shift)} className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-white transition-opacity hover:opacity-80" style={{ backgroundColor: avatarColor(member.id) }}>
                                              <div className="font-semibold">{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</div>
                                            </button>
                                            <a href={buildGcalUrl(shift, `${member.firstName} ${member.lastName}`)} target="_blank" rel="noopener noreferrer" title="Add to Google Calendar" onClick={e => e.stopPropagation()} className="absolute top-1 right-1 hidden group-hover/card:flex items-center justify-center w-5 h-5 rounded bg-white/20 hover:bg-white/40 transition-colors text-white text-[10px] leading-none">📅</a>
                                          </div>
                                        ))}
                                        <button onClick={() => openAdd(member.id, dateKey(day), loc.id)} className={`w-full rounded-lg border border-dashed py-1.5 text-center text-xs transition-all ${dayShifts.length === 0 ? 'min-h-[44px] border-transparent text-gray-300 hover:border-[#1D9E75] hover:text-[#1D9E75] group-hover:border-gray-200' : 'border-gray-200 text-gray-300 hover:border-[#1D9E75] hover:text-[#1D9E75]'}`}>+</button>
                                      </div>
                                    </td>
                                  )
                                })}
                                <td className="w-20 px-3 py-3 text-center">
                                  {hrs > 0 ? <span className={`text-sm font-bold tabular-nums ${hrs >= 40 ? 'text-amber-600' : 'text-gray-700'}`}>{hrs % 1 === 0 ? hrs : hrs.toFixed(1)}</span> : <span className="text-xs text-gray-300">—</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* ── By-Staff view (original) ── */
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b bg-[#EFECE4]">
                  {/* Sticky staff column header */}
                  <th className="sticky left-0 z-20 w-52 border-r border-gray-200 bg-[#EFECE4] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Staff
                  </th>
                  {weekDays.map((day, i) => {
                    const isToday = dateKey(day) === dateKey(new Date())
                    return (
                      <th
                        key={i}
                        className={`min-w-[130px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide ${
                          isToday ? 'text-[#1D9E75]' : 'text-gray-500'
                        }`}
                      >
                        <div>{DAY_LABELS[i]}</div>
                        <div className={`mt-0.5 text-base font-bold ${isToday ? 'text-[#1D9E75]' : 'text-gray-700'}`}>
                          {formatMonthDay(day)}
                        </div>
                      </th>
                    )
                  })}
                  {/* Hours column */}
                  <th className="w-20 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Hrs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStaff.map((member) => {
                  const weekHours = hoursMap.get(member.id) ?? 0
                  const isUnscheduled = weekHours === 0
                  return (
                    <tr key={member.id} className={`group hover:bg-[#F7F5F0] ${isUnscheduled ? 'border-l-2 border-l-amber-300' : ''}`}>
                      {/* Sticky staff cell */}
                      <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-4 py-3 group-hover:bg-[#F7F5F0]">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: avatarColor(member.id) }}
                          >
                            {`${member.firstName[0]}${member.lastName[0]}`.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                              {member.firstName} {member.lastName}
                            </p>
                            <p className="text-xs text-gray-400 capitalize leading-tight">
                              {member.role.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Day cells */}
                      {weekDays.map((day, i) => {
                        const key = `${member.id}__${dateKey(day)}`
                        const dayShifts = shiftMap.get(key) ?? []
                        const isToday = dateKey(day) === dateKey(new Date())

                        return (
                          <td
                            key={i}
                            className={`min-w-[130px] px-2 py-2 align-top ${isToday ? 'bg-[#F0FBF6]' : ''}`}
                          >
                            <div className="space-y-1">
                              {dayShifts.map((shift) => (
                                <div key={shift.id} className="group/card relative">
                                  <button
                                    onClick={() => openEdit(shift)}
                                    className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-white transition-opacity hover:opacity-80"
                                    style={{ backgroundColor: avatarColor(member.id) }}
                                  >
                                    <div className="font-semibold">{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</div>
                                    {shift.location.name && (
                                      <div className="mt-0.5 opacity-75 truncate">{shift.location.name}</div>
                                    )}
                                  </button>
                                  <a
                                    href={buildGcalUrl(shift, `${member.firstName} ${member.lastName}`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Add to Google Calendar"
                                    onClick={e => e.stopPropagation()}
                                    className="absolute top-1 right-1 hidden group-hover/card:flex items-center justify-center w-5 h-5 rounded bg-white/20 hover:bg-white/40 transition-colors text-white text-[10px] leading-none"
                                  >
                                    📅
                                  </a>
                                </div>
                              ))}
                              <button
                                onClick={() => openAdd(member.id, dateKey(day))}
                                className={`w-full rounded-lg border border-dashed py-1.5 text-center text-xs transition-all ${
                                  dayShifts.length === 0
                                    ? 'min-h-[44px] border-transparent text-gray-300 hover:border-[#1D9E75] hover:text-[#1D9E75] group-hover:border-gray-200'
                                    : 'border-gray-200 text-gray-300 hover:border-[#1D9E75] hover:text-[#1D9E75]'
                                }`}
                              >
                                +
                              </button>
                            </div>
                          </td>
                        )
                      })}

                      {/* Hours cell */}
                      <td className="w-20 px-3 py-3 text-center">
                        {weekHours > 0 ? (
                          <span className={`text-sm font-bold tabular-nums ${
                            weekHours >= 40 ? 'text-amber-600' : 'text-gray-700'
                          }`}>
                            {weekHours % 1 === 0 ? weekHours : weekHours.toFixed(1)}
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                            Open
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>


      {/* Add / Edit shift modal */}
      {modal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50 }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                {modal.mode === 'add' ? 'Add Shift' : 'Edit Shift'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {modalStaffMember && `${modalStaffMember.firstName} ${modalStaffMember.lastName}`}
                {' · '}
                {modal.mode === 'add'
                  ? new Date(modal.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                  : new Date(modal.shift.date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                }
              </p>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Shift templates */}
              {templates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Pick</p>
                  <div className="flex flex-wrap gap-1.5">
                    {templates.map(t => (
                      <div key={t.id} className="flex items-center gap-0">
                        <button
                          onClick={() => applyTemplate(t)}
                          className="rounded-l-full border border-r-0 border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-[#1D9E75] hover:bg-[#F0FAF6] hover:text-[#1D9E75] transition-colors"
                        >
                          {t.name}
                          <span className="ml-1.5 font-normal text-gray-400">
                            {formatTime(t.startTime)}–{formatTime(t.endTime)}
                          </span>
                        </button>
                        <button
                          onClick={() => deleteTemplate(t.id)}
                          className="rounded-r-full border border-gray-200 px-2 py-1 text-[10px] text-gray-300 hover:border-red-200 hover:bg-red-50 hover:text-red-400 transition-colors"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Start</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.startTime}
                    onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">End</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.endTime}
                    onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>

              {/* Duration hint */}
              {form.startTime && form.endTime && (
                <p className="text-xs text-gray-400 -mt-2">
                  {calcHours(form.startTime, form.endTime).toFixed(1)} hrs
                </p>
              )}

              {/* Location */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Location</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.locationId}
                  onChange={(e) => setForm(f => ({ ...f, locationId: e.target.value }))}
                >
                  <option value="">Select location…</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Specialty */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Specialty <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.specialty}
                  onChange={(e) => setForm(f => ({ ...f, specialty: e.target.value }))}
                >
                  <option value="">None</option>
                  {SPECIALTIES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Repeat pattern — add mode only */}
              {modal.mode === 'add' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Repeat</label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      value={recurrence}
                      onChange={e => setRecurrence(e.target.value as typeof recurrence)}
                    >
                      <option value="none">No repeat</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    {recurrence !== 'none' && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={2}
                          max={26}
                          className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                          value={repeatCount}
                          onChange={e => setRepeatCount(Math.max(2, Math.min(26, parseInt(e.target.value) || 2)))}
                        />
                        <span className="text-xs text-gray-400 whitespace-nowrap">times</span>
                      </div>
                    )}
                  </div>
                  {recurrence !== 'none' && (
                    <p className="mt-1 text-xs text-gray-400">
                      Creates {repeatCount} shifts — this one + {repeatCount - 1} more
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Notes <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Any notes…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Save as template */}
              {showSaveTemplate ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder='Template name, e.g. "Morning 9–5"'
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate() }}
                  />
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!newTemplateName.trim()}
                    className="rounded-lg bg-gray-800 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-40"
                  >Save</button>
                  <button
                    onClick={() => setShowSaveTemplate(false)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
                  >✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveTemplate(true)}
                  className="text-xs text-gray-400 hover:text-[#1D9E75] transition-colors"
                >
                  + Save as template
                </button>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="flex gap-2">
                {modal.mode === 'edit' && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting ? '…' : 'Delete'}
                  </button>
                )}
                <button
                  onClick={() => setModal(null)}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-[#F0EDE5]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className="flex-1 rounded-lg bg-[#1D9E75] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : modal.mode === 'add'
                    ? recurrence !== 'none' ? `Add ${repeatCount} Shifts` : 'Add Shift'
                    : 'Save'
                  }
                </button>
              </div>
              {modal.mode === 'edit' && (
                <div className="mt-3 text-center">
                  <a
                    href={buildGcalUrl(modal.shift, modalStaffMember ? `${modalStaffMember.firstName} ${modalStaffMember.lastName}` : 'Staff')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#1D9E75] transition-colors"
                  >
                    <span>📅</span> Add to Google Calendar
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
