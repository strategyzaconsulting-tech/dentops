import { useEffect, useState, useMemo } from 'react'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const SPECIALTIES = [
  'General Dentistry', 'Orthodontics', 'Periodontics',
  'Endodontics', 'Oral Surgery', 'Hygiene', 'Front Desk',
]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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

type ModalState =
  | { mode: 'add'; date: string; userId: string }
  | { mode: 'edit'; shift: Shift }
  | null

export default function Schedules() {
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()))
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [form, setForm] = useState<ShiftForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday]
  )

  const weekStart = dateKey(monday)

  async function fetchAll() {
    setLoading(true)
    try {
      const [staffRes, locRes, shiftRes] = await Promise.all([
        fetch(`${API_BASE}/api/staff?practiceId=${PRACTICE_ID}`),
        fetch(`${API_BASE}/api/locations?practiceId=${PRACTICE_ID}`),
        fetch(`${API_BASE}/api/shifts?practiceId=${PRACTICE_ID}&weekStart=${weekStart}`),
      ])
      const [staffData, locData, shiftData] = await Promise.all([
        staffRes.json(), locRes.json(), shiftRes.json(),
      ])
      setStaff(Array.isArray(staffData) ? staffData.filter((s: StaffMember) => s.status !== 'inactive') : [])
      setLocations(Array.isArray(locData) ? locData : [])
      setShifts(Array.isArray(shiftData) ? shiftData : [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [weekStart])

  // shift lookup: userId+dateKey → Shift[]
  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const s of shifts) {
      const key = `${s.userId}__${s.date.split('T')[0]}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [shifts])

  function openAdd(userId: string, date: string) {
    setForm({
      ...emptyForm,
      userId,
      locationId: locations[0]?.id ?? '',
    })
    setModal({ mode: 'add', date, userId })
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
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (modal?.mode === 'add') {
        await fetch(`${API_BASE}/api/shifts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            practiceId: PRACTICE_ID,
            userId: form.userId,
            locationId: form.locationId,
            date: modal.date,
            startTime: form.startTime,
            endTime: form.endTime,
            specialty: form.specialty || undefined,
            notes: form.notes || undefined,
          }),
        })
      } else if (modal?.mode === 'edit') {
        await fetch(`${API_BASE}/api/shifts/${modal.shift.id}`, {
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
      await fetch(`${API_BASE}/api/shifts/${modal.shift.id}`, { method: 'DELETE' })
      setModal(null)
      await fetchAll()
    } finally {
      setDeleting(false)
    }
  }

  const canSave = form.locationId && form.startTime && form.endTime && form.userId

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-gray-500 hover:text-gray-800">← Back</a>
            <span className="text-gray-300">|</span>
            <h1 className="text-xl font-bold text-gray-900">Schedules</h1>
          </div>
          {/* Week navigator */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMonday((m) => addDays(m, -7))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ←
            </button>
            <span className="min-w-[180px] text-center text-sm font-semibold text-gray-700">
              {formatWeekRange(monday)}
            </span>
            <button
              onClick={() => setMonday((m) => addDays(m, 7))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              →
            </button>
            <button
              onClick={() => setMonday(getMonday(new Date()))}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Today
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
        ) : staff.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">
            No active staff.{' '}
            <a href="/staff" className="text-[#1D9E75] hover:underline">Add staff first →</a>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  {/* Staff column header */}
                  <th className="w-48 border-r px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Staff
                  </th>
                  {weekDays.map((day, i) => {
                    const isToday = dateKey(day) === dateKey(new Date())
                    return (
                      <th
                        key={i}
                        className={`min-w-[120px] px-3 py-3 text-center text-xs font-semibold uppercase ${
                          isToday ? 'text-[#1D9E75]' : 'text-gray-500'
                        }`}
                      >
                        <div>{DAY_LABELS[i]}</div>
                        <div
                          className={`mt-0.5 text-base font-bold ${
                            isToday ? 'text-[#1D9E75]' : 'text-gray-700'
                          }`}
                        >
                          {formatMonthDay(day)}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map((member) => (
                  <tr key={member.id} className="group hover:bg-gray-50/50">
                    {/* Staff name cell */}
                    <td className="border-r px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: avatarColor(member.id) }}
                        >
                          {`${member.firstName[0]}${member.lastName[0]}`.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 leading-tight">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-xs text-gray-400 capitalize">
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
                          className={`relative min-w-[120px] px-2 py-2 align-top ${
                            isToday ? 'bg-[#F0FBF6]' : ''
                          }`}
                        >
                          {dayShifts.length > 0 ? (
                            <div className="space-y-1">
                              {dayShifts.map((shift) => (
                                <button
                                  key={shift.id}
                                  onClick={() => openEdit(shift)}
                                  className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-white transition-opacity hover:opacity-80"
                                  style={{ backgroundColor: avatarColor(member.id) }}
                                >
                                  <div>{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</div>
                                  {shift.location.name && (
                                    <div className="opacity-80 truncate">{shift.location.name}</div>
                                  )}
                                </button>
                              ))}
                              {/* Add another shift for this day */}
                              <button
                                onClick={() => openAdd(member.id, dateKey(day))}
                                className="w-full rounded-md border border-dashed border-gray-300 py-1 text-center text-xs text-gray-400 hover:border-[#1D9E75] hover:text-[#1D9E75]"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openAdd(member.id, dateKey(day))}
                              className="flex h-full w-full min-h-[48px] items-center justify-center rounded-md border border-dashed border-transparent text-gray-300 transition-all hover:border-[#1D9E75] hover:text-[#1D9E75] group-hover:border-gray-200"
                            >
                              <span className="text-lg leading-none">+</span>
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
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
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-gray-900">
              {modal.mode === 'add' ? 'Add shift' : 'Edit shift'}
            </h3>
            <p className="mb-5 text-xs text-gray-400">
              {modal.mode === 'add'
                ? `${staff.find((s) => s.id === modal.userId)?.firstName} ${staff.find((s) => s.id === modal.userId)?.lastName} · ${new Date(modal.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
                : `${modal.shift.user.firstName} ${modal.shift.user.lastName} · ${new Date(modal.shift.date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
              }
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Start</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">End</label>
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
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Specialty <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.specialty}
                  onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                >
                  <option value="">None</option>
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Notes <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Any notes…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
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
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="flex-1 rounded-lg bg-[#1D9E75] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Add shift' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
