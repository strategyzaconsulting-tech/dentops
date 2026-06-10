import { useEffect, useState } from 'react'
import StaffFilePanel from './StaffFilePanel'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const ROLES = ['doctor', 'staff', 'hygienist', 'front_desk', 'manager']
const STATUSES = ['active', 'on_leave', 'terminated', 'resigned']

const STATUS_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  active:     { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  label: 'Active' },
  on_leave:   { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400',   label: 'On Leave' },
  terminated: { badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    label: 'Terminated' },
  resigned:   { badge: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400',   label: 'Resigned' },
  invited:    { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', label: 'Invited' },
  inactive:   { badge: 'bg-gray-100 text-gray-400',     dot: 'bg-gray-300',   label: 'Inactive' },
}

const ROLE_STYLES: Record<string, string> = {
  doctor:     'bg-blue-50 text-blue-700',
  staff:      'bg-[#E1F5EE] text-[#085041]',
  hygienist:  'bg-purple-50 text-purple-700',
  front_desk: 'bg-orange-50 text-orange-700',
  manager:    'bg-indigo-50 text-indigo-700',
}

const SEPARATION_STATUSES = new Set(['terminated', 'resigned'])

interface StaffMember {
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
}

type ModalMode = 'add' | 'edit'

interface FormState {
  firstName: string
  lastName: string
  email: string
  role: string
  status: string
  shiftStart: string
  shiftEnd: string
  hireDate: string
  managerId: string
  separationDate: string
}

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'staff',
  status: 'active',
  shiftStart: '',
  shiftEnd: '',
  hireDate: '',
  managerId: '',
  separationDate: '',
}

function fmt12h(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(f: string, l: string) {
  return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase()
}

function avatarColor(id: string) {
  const palette = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % palette.length
  return palette[h]
}

interface BenefitRow {
  id: string
  name: string
  isDefault: boolean
  sortOrder: number
  enabled: boolean
}

const STATUS_GROUPS = [
  { key: 'active',     label: 'Active' },
  { key: 'on_leave',   label: 'On Leave' },
  { key: 'resigned',   label: 'Resigned' },
  { key: 'terminated', label: 'Terminated' },
  { key: 'other',      label: 'Other' },
]

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: ModalMode; member?: StaffMember } | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [filePanel, setFilePanel] = useState<StaffMember | null>(null)

  const [benefits, setBenefits] = useState<BenefitRow[]>([])
  const [newBenefitName, setNewBenefitName] = useState('')
  const [addingBenefit, setAddingBenefit] = useState(false)
  const [showNewBenefitInput, setShowNewBenefitInput] = useState(false)

  async function fetchStaff() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/staff?practiceId=${PRACTICE_ID}`)
      const data = await res.json()
      setStaff(Array.isArray(data) ? data : [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStaff() }, [])

  function openAdd() {
    setForm(emptyForm)
    setBenefits([])
    setShowNewBenefitInput(false)
    setNewBenefitName('')
    setModal({ mode: 'add' })
  }

  async function openEdit(member: StaffMember) {
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      role: member.role,
      status: member.status,
      shiftStart: member.shiftStart ?? '',
      shiftEnd: member.shiftEnd ?? '',
      hireDate: member.hireDate ? member.hireDate.split('T')[0] : '',
      managerId: member.managerId ?? '',
      separationDate: member.separationDate ? member.separationDate.split('T')[0] : '',
    })
    setShowNewBenefitInput(false)
    setNewBenefitName('')
    setModal({ mode: 'edit', member })

    try {
      const res = await fetch(`${API_BASE}/api/benefits/user?practiceId=${PRACTICE_ID}&userId=${member.id}`)
      const data = await res.json()
      if (Array.isArray(data)) setBenefits(data)
    } catch { /* silent */ }
  }

  async function handleToggleBenefit(benefitId: string, enabled: boolean, userId: string) {
    setBenefits((prev) => prev.map((b) => b.id === benefitId ? { ...b, enabled } : b))
    try {
      await fetch(`${API_BASE}/api/benefits/user`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: PRACTICE_ID, userId, benefitId, enabled }),
      })
    } catch {
      setBenefits((prev) => prev.map((b) => b.id === benefitId ? { ...b, enabled: !enabled } : b))
    }
  }

  async function handleAddBenefit() {
    if (!newBenefitName.trim()) return
    setAddingBenefit(true)
    try {
      const res = await fetch(`${API_BASE}/api/benefits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: PRACTICE_ID, name: newBenefitName.trim() }),
      })
      if (res.ok) {
        const newB = await res.json()
        setBenefits((prev) => [...prev, { ...newB, enabled: false }])
        setNewBenefitName('')
        setShowNewBenefitInput(false)
      }
    } catch { /* silent */ }
    finally { setAddingBenefit(false) }
  }

  async function handleDeleteBenefit(benefitId: string) {
    if (!confirm('Remove this benefit from the practice?')) return
    await fetch(`${API_BASE}/api/benefits/${benefitId}`, { method: 'DELETE' })
    setBenefits((prev) => prev.filter((b) => b.id !== benefitId))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        ...form,
        shiftStart: form.shiftStart || null,
        shiftEnd: form.shiftEnd || null,
        hireDate: form.hireDate || null,
        managerId: form.managerId || null,
        separationDate: form.separationDate || null,
      }
      if (modal?.mode === 'add') {
        await fetch(`${API_BASE}/api/staff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ practiceId: PRACTICE_ID, ...payload }),
        })
      } else if (modal?.mode === 'edit' && modal.member) {
        await fetch(`${API_BASE}/api/staff/${modal.member.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      setModal(null)
      await fetchStaff()
    } finally {
      setSaving(false)
    }
  }

  const q = search.toLowerCase()
  const filtered = staff.filter((s) =>
    s.firstName.toLowerCase().includes(q) ||
    s.lastName.toLowerCase().includes(q) ||
    s.email.toLowerCase().includes(q) ||
    s.role.toLowerCase().includes(q)
  )

  const KNOWN_STATUSES = new Set(['active', 'on_leave', 'terminated', 'resigned'])
  const displayed = statusFilter === 'all'
    ? filtered
    : statusFilter === 'other'
    ? filtered.filter(s => !KNOWN_STATUSES.has(s.status))
    : filtered.filter(s => s.status === statusFilter)

  const countByStatus = (key: string) => {
    if (key === 'all') return filtered.length
    if (key === 'other') return filtered.filter(s => !KNOWN_STATUSES.has(s.status)).length
    return filtered.filter(s => s.status === key).length
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-gray-500 hover:text-gray-800">← Back</a>
            <span className="text-gray-300">|</span>
            <h1 className="text-xl font-bold text-gray-900">Staff</h1>
            {!loading && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
                {staff.length}
              </span>
            )}
          </div>
          <button
            onClick={openAdd}
            className="rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + Add Staff
          </button>
        </div>
      </header>

      <main className="container py-6">
        {/* Search + status filter bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Search name, email, or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                statusFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              All <span className="ml-1 opacity-60">{countByStatus('all')}</span>
            </button>
            {STATUS_GROUPS.filter(g => countByStatus(g.key) > 0 || g.key === 'active').map(g => (
              <button
                key={g.key}
                onClick={() => setStatusFilter(g.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  statusFilter === g.key
                    ? 'bg-gray-800 text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                {g.label}
                {countByStatus(g.key) > 0 && (
                  <span className="ml-1 opacity-60">{countByStatus(g.key)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">
            {search ? 'No staff match your search.' : `No ${statusFilter === 'all' ? '' : statusFilter.replace('_', ' ')} staff members.`}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((member) => {
              const st = STATUS_STYLES[member.status] ?? STATUS_STYLES['inactive']
              const isSeparated = SEPARATION_STATUSES.has(member.status)
              return (
                <div
                  key={member.id}
                  className={`rounded-2xl bg-white border shadow-sm flex flex-col transition-shadow hover:shadow-md ${
                    isSeparated ? 'border-gray-200 opacity-80' : 'border-gray-100'
                  }`}
                >
                  {/* Card top */}
                  <div className="flex items-start gap-4 p-5 pb-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${isSeparated ? 'opacity-60' : ''}`}
                      style={{ backgroundColor: avatarColor(member.id) }}
                    >
                      {initials(member.firstName, member.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-gray-900 truncate ${isSeparated ? 'text-gray-500' : ''}`}>
                        {member.firstName} {member.lastName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[member.role] ?? 'bg-gray-100 text-gray-600'}`}>
                          {member.role.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${st.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card details */}
                  <div className="px-5 pb-4 space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="text-gray-300">✉</span>
                      <span className="truncate">{member.email}</span>
                    </div>
                    {(member.shiftStart || member.shiftEnd) && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="text-gray-300">◷</span>
                        <span>{fmt12h(member.shiftStart)}{member.shiftEnd ? ` – ${fmt12h(member.shiftEnd)}` : ''}</span>
                      </div>
                    )}
                    {member.hireDate && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="text-gray-300">▷</span>
                        <span>Hired {fmtDate(member.hireDate)}</span>
                      </div>
                    )}
                    {isSeparated && member.separationDate && (
                      <div className="flex items-center gap-2 text-xs text-red-500">
                        <span className="text-red-300">◼</span>
                        <span>{st.label} {fmtDate(member.separationDate)}</span>
                      </div>
                    )}
                  </div>

                  {/* Card actions */}
                  <div className="flex items-center justify-between border-t border-gray-50 px-5 py-3">
                    <button
                      onClick={() => setFilePanel(member)}
                      className="rounded-lg bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Open File
                    </button>
                    <button
                      onClick={() => openEdit(member)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-800"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Staff file panel */}
      {filePanel && (
        <StaffFilePanel
          member={filePanel}
          onClose={() => setFilePanel(null)}
          onEdit={() => {
            openEdit(filePanel)
            setFilePanel(null)
          }}
        />
      )}

      {/* Add / Edit modal */}
      {modal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50 }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                {modal.mode === 'add' ? 'Add Staff Member' : `Edit — ${modal.member?.firstName} ${modal.member?.lastName}`}
              </h3>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">First name</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Last name</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value, separationDate: '' }))}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Hire Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.hireDate}
                    onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
                  />
                </div>
                {SEPARATION_STATUSES.has(form.status) && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      {form.status === 'terminated' ? 'Termination Date' : 'Resignation Date'}
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      value={form.separationDate}
                      onChange={(e) => setForm((f) => ({ ...f, separationDate: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Manager</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.managerId}
                  onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {staff
                    .filter((s) => s.id !== modal?.member?.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.role.replace('_', ' ')})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Default shift hours <span className="text-gray-400 font-normal">(used for tardy detection)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Start</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      value={form.shiftStart}
                      onChange={(e) => setForm((f) => ({ ...f, shiftStart: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">End</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      value={form.shiftEnd}
                      onChange={(e) => setForm((f) => ({ ...f, shiftEnd: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Benefits — edit mode only */}
              {modal.mode === 'edit' && (
                <div>
                  <div className="flex items-center justify-between mb-3 pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Benefits</p>
                      <p className="text-xs text-gray-400 mt-0.5">Activate after probationary period</p>
                    </div>
                    <button
                      onClick={() => setShowNewBenefitInput((v) => !v)}
                      className="flex items-center gap-1 rounded-lg border border-dashed border-[#1D9E75] px-2.5 py-1 text-xs font-semibold text-[#1D9E75] hover:bg-[#E8F5F0]"
                    >
                      + Add
                    </button>
                  </div>

                  {showNewBenefitInput && (
                    <div className="mb-3 flex gap-2">
                      <input
                        type="text"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                        placeholder="e.g. Dental, Vision, Life Insurance…"
                        value={newBenefitName}
                        onChange={(e) => setNewBenefitName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddBenefit() }}
                        autoFocus
                      />
                      <button
                        onClick={handleAddBenefit}
                        disabled={addingBenefit || !newBenefitName.trim()}
                        className="rounded-lg bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {addingBenefit ? '…' : 'Add'}
                      </button>
                    </div>
                  )}

                  {benefits.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">Loading benefits…</p>
                  ) : (
                    <div className="space-y-2">
                      {benefits.map((b) => (
                        <div key={b.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{b.name}</span>
                            {b.isDefault && (
                              <span className="rounded-full bg-[#E8F5F0] px-2 py-0.5 text-xs font-medium text-[#1D9E75]">Standard</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleBenefit(b.id, !b.enabled, modal.member!.id)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${b.enabled ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${b.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                            </button>
                            {!b.isDefault && (
                              <button
                                onClick={() => handleDeleteBenefit(b.id)}
                                className="text-gray-300 hover:text-red-500 text-xs leading-none"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.firstName || !form.lastName || !form.email}
                className="flex-1 rounded-lg bg-[#1D9E75] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Add Member' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
