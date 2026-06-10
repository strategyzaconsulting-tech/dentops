import { useEffect, useState } from 'react'
import EmployeeReportModal from './EmployeeReportModal'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const TYPE_STYLE: Record<string, string> = {
  tardy: 'bg-amber-100 text-amber-700',
  unexcused_absence: 'bg-red-100 text-red-700',
  verbal_warning: 'bg-orange-100 text-orange-700',
  written_warning: 'bg-rose-100 text-rose-700',
  note: 'bg-blue-100 text-blue-700',
}

const TYPE_LABEL: Record<string, string> = {
  tardy: 'Tardy',
  unexcused_absence: 'Absent',
  verbal_warning: 'Verbal Warning',
  written_warning: 'Written Warning',
  note: 'Event of Note',
}

const DOT_COLOR: Record<string, string> = {
  tardy: 'bg-amber-400',
  unexcused_absence: 'bg-red-500',
  verbal_warning: 'bg-orange-400',
  written_warning: 'bg-rose-600',
  note: 'bg-blue-400',
}

const MANUAL_TYPES = [
  { key: 'verbal_warning', label: 'Verbal Warning' },
  { key: 'written_warning', label: 'Written Warning' },
  { key: 'note', label: 'Event of Note' },
]

const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'tardy', label: 'Tardies' },
  { key: 'unexcused_absence', label: 'Absences' },
  { key: 'verbal_warning', label: 'Verbal' },
  { key: 'written_warning', label: 'Written' },
  { key: 'note', label: 'Notes' },
]

const DATE_RANGES = [
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: '6mo', label: '6mo', days: 180 },
  { key: 'year', label: 'Year', days: 365 },
] as const
type RangeKey = (typeof DATE_RANGES)[number]['key']

const ROLE_STYLES: Record<string, string> = {
  doctor: 'bg-blue-100 text-blue-700',
  staff: 'bg-[#E1F5EE] text-[#085041]',
  hygienist: 'bg-purple-100 text-purple-700',
  front_desk: 'bg-orange-100 text-orange-700',
  manager: 'bg-indigo-100 text-indigo-700',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  invited: 'bg-yellow-100 text-yellow-700',
  inactive: 'bg-gray-100 text-gray-500',
}

function avatarColor(id: string) {
  const palette = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % palette.length
  return palette[h]
}

function initials(f: string, l: string) {
  return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase()
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function rangeStart(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

export interface StaffMember {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  status: string
  shiftStart: string | null
  shiftEnd: string | null
  hireDate: string | null
  managerId: string | null
  separationDate: string | null
  phone: string | null
  address: string | null
}

interface Occurrence {
  id: string
  date: string
  type: string
  notes: string | null
  createdAt: string
}

interface Props {
  member: StaffMember
  onClose: () => void
  onEdit: () => void
}

export default function StaffFilePanel({ member, onClose, onEdit }: Props) {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [scheduledDays, setScheduledDays] = useState<number | null>(null)
  const [loadingOcc, setLoadingOcc] = useState(true)
  const [loadingShifts, setLoadingShifts] = useState(true)
  const [dateRange, setDateRange] = useState<RangeKey>('90d')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ type: 'verbal_warning', date: toISODate(new Date()), notes: '' })
  const [adding, setAdding] = useState(false)
  const [reportData, setReportData] = useState<unknown>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const rangeDays = DATE_RANGES.find(r => r.key === dateRange)!.days
  const from = rangeStart(rangeDays)

  useEffect(() => {
    setLoadingOcc(true)
    fetch(`${API_BASE}/api/occurrences?practiceId=${PRACTICE_ID}&userId=${member.id}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOccurrences(data) })
      .catch(() => {})
      .finally(() => setLoadingOcc(false))
  }, [member.id])

  useEffect(() => {
    setLoadingShifts(true)
    const fromStr = toISODate(from)
    const toStr = toISODate(today)
    fetch(`${API_BASE}/api/shifts?practiceId=${PRACTICE_ID}&userId=${member.id}&from=${fromStr}&to=${toStr}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setScheduledDays(data.length) })
      .catch(() => {})
      .finally(() => setLoadingShifts(false))
  }, [member.id, dateRange])

  const inRange = occurrences.filter(o => {
    const d = new Date(o.date)
    return d >= from && d <= today
  })
  const tardiesInRange = inRange.filter(o => o.type === 'tardy').length
  const absencesInRange = inRange.filter(o => o.type === 'unexcused_absence').length
  const attendancePct =
    scheduledDays !== null && scheduledDays > 0
      ? Math.max(0, Math.round(((scheduledDays - absencesInRange) / scheduledDays) * 100))
      : null

  const displayed =
    typeFilter === 'all' ? occurrences : occurrences.filter(o => o.type === typeFilter)

  async function generateReport() {
    setGeneratingReport(true)
    setReportError(null)
    try {
      const res = await fetch(`${API_BASE}/api/staff/${member.id}/report?practiceId=${PRACTICE_ID}&days=365`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setReportError(err.error ?? `Server error (${res.status})`)
        return
      }
      const data = await res.json()
      setReportData(data)
    } catch {
      setReportError('Could not reach the server.')
    } finally {
      setGeneratingReport(false)
    }
  }

  async function handleAddEntry() {
    setAdding(true)
    try {
      const res = await fetch(`${API_BASE}/api/occurrences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: PRACTICE_ID,
          userId: member.id,
          date: addForm.date,
          type: addForm.type,
          notes: addForm.notes.trim() || null,
        }),
      })
      if (res.ok) {
        const occ: Occurrence = await res.json()
        setOccurrences(prev =>
          [occ, ...prev].sort((a, b) => b.date.localeCompare(a.date))
        )
        setShowAddForm(false)
        setAddForm({ type: 'verbal_warning', date: toISODate(new Date()), notes: '' })
      }
    } catch { /* silent */ }
    finally { setAdding(false) }
  }

  const stats = [
    {
      label: 'Scheduled Days',
      value: loadingShifts ? '…' : (scheduledDays ?? 0).toString(),
      sub: 'in period',
      valueClass: 'text-gray-900',
      cardClass: 'bg-gray-50',
    },
    {
      label: 'Tardies',
      value: tardiesInRange.toString(),
      sub: 'late clock-ins',
      valueClass: tardiesInRange > 0 ? 'text-amber-600' : 'text-gray-900',
      cardClass: tardiesInRange > 0 ? 'bg-amber-50' : 'bg-gray-50',
    },
    {
      label: 'Absences',
      value: absencesInRange.toString(),
      sub: 'unexcused',
      valueClass: absencesInRange > 0 ? 'text-red-600' : 'text-gray-900',
      cardClass: absencesInRange > 0 ? 'bg-red-50' : 'bg-gray-50',
    },
    {
      label: 'Attendance',
      value: loadingShifts
        ? '…'
        : attendancePct !== null
        ? `${attendancePct}%`
        : 'N/A',
      sub: 'of scheduled',
      valueClass:
        attendancePct === null
          ? 'text-gray-400'
          : attendancePct >= 95
          ? 'text-[#1D9E75]'
          : attendancePct >= 85
          ? 'text-amber-600'
          : 'text-red-600',
      cardClass:
        attendancePct === null
          ? 'bg-gray-50'
          : attendancePct >= 95
          ? 'bg-[#E8F5F0]'
          : attendancePct >= 85
          ? 'bg-amber-50'
          : 'bg-red-50',
    },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-100 shrink-0">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: avatarColor(member.id) }}
          >
            {initials(member.firstName, member.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">
                {member.firstName} {member.lastName}
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  ROLE_STYLES[member.role] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {member.role.replace('_', ' ')}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  STATUS_STYLES[member.status] ?? 'bg-gray-100 text-gray-500'
                }`}
              >
                {member.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              <p className="text-xs text-gray-400">{member.email}</p>
              {member.phone && <p className="text-xs text-gray-400">{member.phone}</p>}
              {member.address && <p className="text-xs text-gray-400">{member.address}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={generateReport}
              disabled={generatingReport}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60 transition-colors"
            >
              {generatingReport ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating…
                </>
              ) : (
                <>
                  <span className="text-[10px]">✦</span> Generate Report
                </>
              )}
            </button>
            <button
              onClick={onEdit}
              className="text-xs font-semibold text-[#1D9E75] hover:underline"
            >
              Edit Profile
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* At a Glance */}
          <section className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                At a Glance
              </h3>
              <div className="flex gap-1 bg-gray-100 rounded-full p-0.5">
                {DATE_RANGES.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setDateRange(r.key)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      dateRange === r.key
                        ? 'bg-white text-gray-800 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {stats.map(s => (
                <div key={s.label} className={`rounded-xl p-4 ${s.cardClass}`}>
                  <p className={`text-2xl font-bold tabular-nums ${s.valueClass}`}>{s.value}</p>
                  <p className="text-xs font-semibold text-gray-700 mt-1 leading-tight">{s.label}</p>
                  <p className="text-xs text-gray-400 leading-tight">{s.sub}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Occurrence Log */}
          <section className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Occurrence Log
              </h3>
              <button
                onClick={() => setShowAddForm(v => !v)}
                className="flex items-center gap-1 rounded-lg border border-dashed border-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-[#1D9E75] hover:bg-[#E8F5F0] transition-colors"
              >
                + Add Entry
              </button>
            </div>

            {/* Add entry form */}
            {showAddForm && (
              <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      value={addForm.type}
                      onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))}
                    >
                      {MANUAL_TYPES.map(t => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      value={addForm.date}
                      onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
                    rows={3}
                    placeholder="Describe the occurrence…"
                    value={addForm.notes}
                    onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddEntry}
                    disabled={adding}
                    className="px-4 py-1.5 rounded-lg bg-[#1D9E75] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {adding ? 'Saving…' : 'Save Entry'}
                  </button>
                </div>
              </div>
            )}

            {/* Type filter chips */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {FILTER_CHIPS.map(chip => {
                const count =
                  chip.key === 'all'
                    ? occurrences.length
                    : occurrences.filter(o => o.type === chip.key).length
                return (
                  <button
                    key={chip.key}
                    onClick={() => setTypeFilter(chip.key)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      typeFilter === chip.key
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {chip.label}
                    {count > 0 && (
                      <span
                        className={`text-xs rounded-full px-1.5 py-0 leading-4 font-semibold ${
                          typeFilter === chip.key
                            ? 'bg-white/20 text-white'
                            : 'bg-white text-gray-500'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Timeline */}
            {loadingOcc ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
            ) : displayed.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-400 italic">
                  No entries{typeFilter !== 'all' ? ' of this type' : ''} on record.
                </p>
              </div>
            ) : (
              <div>
                {displayed.map((occ, idx) => {
                  const d = new Date(occ.date)
                  const dateStr = d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  const isAuto =
                    occ.type === 'tardy' || occ.type === 'unexcused_absence'
                  const isLast = idx === displayed.length - 1

                  return (
                    <div key={occ.id} className="flex gap-4">
                      {/* Spine */}
                      <div className="flex flex-col items-center shrink-0 w-4">
                        <div
                          className={`mt-1.5 h-3 w-3 rounded-full border-2 border-white shadow-sm shrink-0 ${
                            DOT_COLOR[occ.type] ?? 'bg-gray-400'
                          }`}
                        />
                        {!isLast && (
                          <div className="w-px flex-1 bg-gray-200 mt-1" style={{ minHeight: 20 }} />
                        )}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-5 ${isLast ? 'pb-8' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                TYPE_STYLE[occ.type] ?? 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {TYPE_LABEL[occ.type] ?? occ.type}
                            </span>
                            {isAuto && (
                              <span className="text-[10px] text-gray-400 italic">
                                from time clock
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 shrink-0 mt-0.5">{dateStr}</span>
                        </div>
                        {occ.notes && (
                          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
                            {occ.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Report error toast */}
      {reportError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-lg bg-red-600 px-5 py-3 text-sm text-white shadow-lg flex items-center gap-3">
          <span>{reportError}</span>
          <button onClick={() => setReportError(null)} className="text-white/70 hover:text-white text-base leading-none">✕</button>
        </div>
      )}

      {/* Report modal */}
      {reportData && (
        <EmployeeReportModal
          report={reportData as Parameters<typeof EmployeeReportModal>[0]['report']}
          onClose={() => setReportData(null)}
        />
      )}
    </>
  )
}
