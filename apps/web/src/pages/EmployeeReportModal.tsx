import { useRef } from 'react'

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

interface Occurrence {
  id: string
  date: string
  type: string
  notes: string | null
}

interface ReportData {
  generatedAt: string
  periodDays: number
  employee: {
    name: string
    email: string
    role: string
    status: string
    hireDate: string | null
    shiftStart: string | null
    shiftEnd: string | null
    manager: string | null
  }
  attendance: {
    scheduledDays: number
    daysPresent: number
    tardies: number
    tardyRate: number | null
    absences: number
    attendanceRate: number | null
    verbalWarnings: number
    writtenWarnings: number
  }
  occurrences: Occurrence[]
  aiSummary: string
}

interface Props {
  report: ReportData
  onClose: () => void
}

function fmt12h(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function renderAiSummary(text: string) {
  return text.split('\n').filter(Boolean).map((line, i) => {
    const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    return <p key={i} className="mb-2 text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: bold }} />
  })
}

const STAT_RISK_COLOR = (rate: number | null) =>
  rate === null ? 'text-gray-400'
  : rate >= 95 ? 'text-[#1D9E75]'
  : rate >= 85 ? 'text-amber-600'
  : 'text-red-600'

export default function EmployeeReportModal({ report, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const { employee, attendance, occurrences, aiSummary } = report

  function handlePrint() {
    window.print()
  }

  const generatedStr = new Date(report.generatedAt).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const stats = [
    { label: 'Scheduled Days', value: attendance.scheduledDays.toString(), sub: `${report.periodDays}-day period` },
    { label: 'Days Present', value: attendance.daysPresent.toString(), sub: 'excl. absences' },
    {
      label: 'Tardies',
      value: `${attendance.tardies}`,
      sub: attendance.tardyRate !== null ? `${attendance.tardyRate}% of shifts` : '',
      valueClass: attendance.tardies > 0 ? 'text-amber-600' : 'text-gray-900',
    },
    {
      label: 'Attendance',
      value: attendance.attendanceRate !== null ? `${attendance.attendanceRate}%` : 'N/A',
      sub: 'of scheduled shifts',
      valueClass: STAT_RISK_COLOR(attendance.attendanceRate),
    },
  ]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden print:inset-0 print:rounded-none print:shadow-none">

        {/* Toolbar — hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0 print:hidden">
          <div>
            <h2 className="text-base font-bold text-gray-900">Employee Report</h2>
            <p className="text-xs text-gray-400">Generated {generatedStr}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Print / Save PDF
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
          </div>
        </div>

        {/* Scrollable report body */}
        <div className="flex-1 overflow-y-auto">
          <div ref={printRef} className="max-w-3xl mx-auto px-8 py-8 print:px-6 print:py-4">

            {/* Report header */}
            <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-900">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Employee File Report</p>
                <h1 className="text-3xl font-bold text-gray-900">{employee.name}</h1>
                <p className="text-sm text-gray-500 mt-1 capitalize">{employee.role.replace('_', ' ')} · {employee.status}</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>{generatedStr}</p>
                <p className="mt-1">{report.periodDays}-day review period</p>
              </div>
            </div>

            {/* Section 1: Employee Info */}
            <section className="mb-8">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Employee Information</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {[
                  { label: 'Full Name', value: employee.name },
                  { label: 'Email', value: employee.email },
                  { label: 'Role', value: employee.role.replace('_', ' '), capitalize: true },
                  { label: 'Status', value: employee.status, capitalize: true },
                  { label: 'Hire Date', value: fmtDate(employee.hireDate) },
                  { label: 'Manager', value: employee.manager ?? '—' },
                  {
                    label: 'Default Shift',
                    value: employee.shiftStart
                      ? `${fmt12h(employee.shiftStart)} – ${fmt12h(employee.shiftEnd) ?? '—'}`
                      : '—',
                  },
                ].map(f => (
                  <div key={f.label} className="flex flex-col">
                    <span className="text-xs text-gray-400 font-medium">{f.label}</span>
                    <span className={`text-sm font-semibold text-gray-800 ${f.capitalize ? 'capitalize' : ''}`}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 2: Attendance At a Glance */}
            <section className="mb-8">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Attendance</h2>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {stats.map(s => (
                  <div key={s.label} className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                    <p className={`text-2xl font-bold tabular-nums ${s.valueClass ?? 'text-gray-900'}`}>{s.value}</p>
                    <p className="text-xs font-semibold text-gray-700 mt-1">{s.label}</p>
                    {s.sub && <p className="text-xs text-gray-400">{s.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Warnings summary row */}
              {(attendance.verbalWarnings > 0 || attendance.writtenWarnings > 0) && (
                <div className="flex gap-3">
                  {attendance.verbalWarnings > 0 && (
                    <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 border border-orange-200">
                      {attendance.verbalWarnings} Verbal Warning{attendance.verbalWarnings > 1 ? 's' : ''}
                    </span>
                  )}
                  {attendance.writtenWarnings > 0 && (
                    <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                      {attendance.writtenWarnings} Written Warning{attendance.writtenWarnings > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </section>

            {/* Section 3: Occurrence Log */}
            <section className="mb-8">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Occurrence Log <span className="text-gray-300 font-normal ml-1">({occurrences.length} total)</span>
              </h2>
              {occurrences.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No occurrences on record.</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 text-left text-xs font-semibold text-gray-500 w-32">Date</th>
                      <th className="py-2 text-left text-xs font-semibold text-gray-500 w-36">Type</th>
                      <th className="py-2 text-left text-xs font-semibold text-gray-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occurrences.map((occ, i) => (
                      <tr key={occ.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="py-2 pr-4 text-gray-500 text-xs align-top whitespace-nowrap">
                          {new Date(occ.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-2 pr-4 align-top">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_STYLE[occ.type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {TYPE_LABEL[occ.type] ?? occ.type}
                          </span>
                        </td>
                        <td className="py-2 text-gray-600 text-xs align-top leading-relaxed">
                          {occ.notes ?? <span className="text-gray-300 italic">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Section 4: AI Summary */}
            <section className="mb-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">AI Summary</h2>
              <div className="rounded-xl bg-gradient-to-br from-[#F0FAF6] to-[#E8F5F0] border border-[#C8E8DC] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-5 rounded-full bg-[#1D9E75] flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-bold">AI</span>
                  </div>
                  <span className="text-xs font-semibold text-[#1D9E75] uppercase tracking-wide">
                    Claude — Cliff Notes
                  </span>
                </div>
                <div>{renderAiSummary(aiSummary)}</div>
              </div>
            </section>

            {/* Print footer */}
            <div className="hidden print:block mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
              <span>Confidential — DentOps Employee Report</span>
              <span>{generatedStr}</span>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(.fixed) { display: none !important; }
          .fixed { position: static !important; inset: auto !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  )
}
