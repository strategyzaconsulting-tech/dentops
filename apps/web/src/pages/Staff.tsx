import { useEffect, useState } from 'react'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const ROLES = ['doctor', 'staff', 'hygienist', 'front_desk', 'manager']
const STATUSES = ['active', 'invited', 'inactive']

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  invited: 'bg-yellow-100 text-yellow-700',
  inactive: 'bg-gray-100 text-gray-500',
}

const ROLE_STYLES: Record<string, string> = {
  doctor: 'bg-blue-100 text-blue-700',
  staff: 'bg-[#E1F5EE] text-[#085041]',
  hygienist: 'bg-purple-100 text-purple-700',
  front_desk: 'bg-orange-100 text-orange-700',
  manager: 'bg-indigo-100 text-indigo-700',
}

interface StaffMember {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  status: string
  shiftStart: string | null
  shiftEnd: string | null
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
}

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'staff',
  status: 'active',
  shiftStart: '',
  shiftEnd: '',
}

function fmt12h(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
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

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: ModalMode; member?: StaffMember } | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  // benefits state
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
    })
    setShowNewBenefitInput(false)
    setNewBenefitName('')
    setModal({ mode: 'edit', member })

    // Load benefits for this staff member
    try {
      const res = await fetch(`${API_BASE}/api/benefits/user?practiceId=${PRACTICE_ID}&userId=${member.id}`)
      const data = await res.json()
      if (Array.isArray(data)) setBenefits(data)
    } catch {
      // silent
    }
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
      // revert on failure
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

  async function toggleStatus(member: StaffMember) {
    const next = member.status === 'active' ? 'inactive' : 'active'
    await fetch(`${API_BASE}/api/staff/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    await fetchStaff()
  }

  const filtered = staff.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
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
            + Add staff
          </button>
        </div>
      </header>

      <main className="container py-8">
        {/* Search */}
        <div className="mb-6 max-w-sm">
          <input
            type="text"
            placeholder="Search by name, email, or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          />
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <th className="px-5 py-3 text-left font-semibold">Name</th>
                  <th className="px-5 py-3 text-left font-semibold">Email</th>
                  <th className="px-5 py-3 text-left font-semibold">Role</th>
                  <th className="px-5 py-3 text-left font-semibold">Shift</th>
                  <th className="px-5 py-3 text-left font-semibold">Status</th>
                  <th className="px-5 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      {search ? 'No staff match your search.' : 'No staff members yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: avatarColor(member.id) }}
                          >
                            {initials(member.firstName, member.lastName)}
                          </div>
                          <span className="font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{member.email}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            ROLE_STYLES[member.role] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {member.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">
                        {member.shiftStart
                          ? <span>{fmt12h(member.shiftStart)}{member.shiftEnd ? ` – ${fmt12h(member.shiftEnd)}` : ''}</span>
                          : <span className="text-gray-300 italic text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            STATUS_STYLES[member.status] ?? 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openEdit(member)}
                            className="text-xs font-medium text-[#1D9E75] hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleStatus(member)}
                            className="text-xs font-medium text-gray-400 hover:text-gray-700"
                          >
                            {member.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

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
              {modal.mode === 'add' ? 'Add staff member' : `Edit — ${modal.member?.firstName} ${modal.member?.lastName}`}
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
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Default shift hours <span className="text-gray-400 font-normal">(used for tardy detection)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Start time</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      value={form.shiftStart}
                      onChange={(e) => setForm((f) => ({ ...f, shiftStart: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">End time</label>
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

                  {/* New benefit input */}
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
                            {/* Toggle switch */}
                            <button
                              onClick={() => handleToggleBenefit(b.id, !b.enabled, modal.member!.id)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${b.enabled ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${b.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
                              />
                            </button>
                            {!b.isDefault && (
                              <button
                                onClick={() => handleDeleteBenefit(b.id)}
                                className="text-gray-300 hover:text-red-500 text-xs leading-none"
                                title="Remove benefit"
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
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Add member' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
