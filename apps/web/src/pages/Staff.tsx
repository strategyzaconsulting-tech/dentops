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
}

type ModalMode = 'add' | 'edit'

interface FormState {
  firstName: string
  lastName: string
  email: string
  role: string
  status: string
}

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'staff',
  status: 'active',
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

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: ModalMode; member?: StaffMember } | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

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
    setModal({ mode: 'add' })
  }

  function openEdit(member: StaffMember) {
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      role: member.role,
      status: member.status,
    })
    setModal({ mode: 'edit', member })
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (modal?.mode === 'add') {
        await fetch(`${API_BASE}/api/staff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ practiceId: PRACTICE_ID, ...form }),
        })
      } else if (modal?.mode === 'edit' && modal.member) {
        await fetch(`${API_BASE}/api/staff/${modal.member.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
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
                  <th className="px-5 py-3 text-left font-semibold">Status</th>
                  <th className="px-5 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
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
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-5 text-base font-semibold text-gray-900">
              {modal.mode === 'add' ? 'Add staff member' : `Edit — ${modal.member?.firstName} ${modal.member?.lastName}`}
            </h3>

            <div className="space-y-4">
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
            </div>

            <div className="mt-6 flex gap-3">
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
