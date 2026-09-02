import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/apiFetch'

const PRACTICE_TYPES = [
  'General Dentistry',
  'Pediatric Dentistry',
  'Orthodontics',
  'Oral Surgery',
  'Periodontics',
  'Endodontics',
  'Prosthodontics',
  'Cosmetic Dentistry',
  'Multi-Specialty',
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const PAYROLL_PERIODS = [
  { value: 'weekly',      label: 'Weekly',       desc: '52 pay periods/year' },
  { value: 'biweekly',   label: 'Bi-Weekly',    desc: '26 pay periods/year' },
  { value: 'semimonthly',label: 'Semi-Monthly',  desc: '24 pay periods/year (e.g. 1st & 15th)' },
  { value: 'monthly',    label: 'Monthly',       desc: '12 pay periods/year' },
]

const DAYS_OF_WEEK = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

interface PracticeData {
  id: string
  name: string
  type: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  website: string | null
  logoUrl: string | null
  brandColor: string | null
  requireSpecialty: boolean
  defaultPtoDays: number
  ptoCustomAllowed: boolean
  payrollPeriod: string | null
  payrollStartDay: number | null
  payrollNextDate: string | null
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-6 py-5 grid gap-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40 focus:border-[#1D9E75] transition'
const selectCls = inputCls + ' bg-white'

interface BenefitPlan {
  id: string
  name: string
  isDefault: boolean
  providerName: string | null
  phone: string | null
  email: string | null
  website: string | null
  notes: string | null
}

interface BenefitForm {
  name: string
  providerName: string
  phone: string
  email: string
  website: string
  notes: string
}

function emptyBenefitForm(b: BenefitPlan): BenefitForm {
  return {
    name: b.name,
    providerName: b.providerName ?? '',
    phone: b.phone ?? '',
    email: b.email ?? '',
    website: b.website ?? '',
    notes: b.notes ?? '',
  }
}

export default function PracticeProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'manager'

  const [form, setForm] = useState<PracticeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Benefits Plans state
  const [benefits, setBenefits] = useState<BenefitPlan[]>([])
  const [expandedBenefitId, setExpandedBenefitId] = useState<string | null>(null)
  const [benefitForms, setBenefitForms] = useState<Record<string, BenefitForm>>({})
  const [benefitSaving, setBenefitSaving] = useState<string | null>(null)
  const [newBenefitName, setNewBenefitName] = useState('')
  const [addingBenefit, setAddingBenefit] = useState(false)
  const [deletingBenefitId, setDeletingBenefitId] = useState<string | null>(null)

  async function loadBenefits() {
    if (!user) return
    const res = await apiFetch(`/api/benefits?practiceId=${user.practiceId}`)
    const data: BenefitPlan[] = await res.json()
    if (Array.isArray(data)) {
      setBenefits(data)
      setBenefitForms(Object.fromEntries(data.map(b => [b.id, emptyBenefitForm(b)])))
    }
  }

  useEffect(() => {
    if (!user) return
    apiFetch(`/api/practice/${user.practiceId}`)
      .then((r) => r.json())
      .then((data) => setForm(data))
      .catch(() => setError('Failed to load practice data.'))
      .finally(() => setLoading(false))
    loadBenefits()
  }, [user])

  async function saveBenefit(id: string) {
    const f = benefitForms[id]
    if (!f) return
    setBenefitSaving(id)
    await apiFetch(`/api/benefits/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: f.name.trim() || undefined,
        providerName: f.providerName.trim() || null,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        website: f.website.trim() || null,
        notes: f.notes.trim() || null,
      }),
    })
    setBenefitSaving(null)
    await loadBenefits()
  }

  async function addBenefit() {
    if (!newBenefitName.trim() || !user) return
    setAddingBenefit(true)
    await apiFetch('/api/benefits', {
      method: 'POST',
      body: JSON.stringify({ practiceId: user.practiceId, name: newBenefitName.trim() }),
    })
    setNewBenefitName('')
    setAddingBenefit(false)
    await loadBenefits()
  }

  async function deleteBenefit(id: string) {
    setDeletingBenefitId(id)
    await apiFetch(`/api/benefits/${id}`, { method: 'DELETE' })
    setDeletingBenefitId(null)
    setExpandedBenefitId(prev => prev === id ? null : prev)
    await loadBenefits()
  }

  function setBenefitField(id: string, key: keyof BenefitForm, value: string) {
    setBenefitForms(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  function set<K extends keyof PracticeData>(key: K, value: PracticeData[K]) {
    setForm((f) => f ? { ...f, [key]: value } : f)
    setSaved(false)
  }

  async function save() {
    if (!form || !user) return
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/practice/${user.practiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          website: form.website,
          logoUrl: form.logoUrl,
          brandColor: form.brandColor,
          requireSpecialty: form.requireSpecialty,
          defaultPtoDays: form.defaultPtoDays,
          ptoCustomAllowed: form.ptoCustomAllowed,
          payrollPeriod: form.payrollPeriod,
          payrollStartDay: form.payrollStartDay,
          payrollNextDate: form.payrollNextDate,
        }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
    } catch {
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-[#2C3E3A]">
        <div className="container flex h-16 items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-[#8BAF9A] hover:text-white transition-colors text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dashboard
          </button>
          <div className="h-4 w-px bg-[#3D5049]" />
          <h1 className="text-sm font-medium text-[#FAF6EF]">Practice Profile</h1>
        </div>
      </header>

      <main className="container py-8 max-w-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>
        ) : !isAdmin ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <p className="text-amber-800 font-medium">Super Admin access required to view this page.</p>
          </div>
        ) : !form ? (
          <div className="text-sm text-red-500">{error ?? 'Failed to load.'}</div>
        ) : (
          <div className="grid gap-6">
            {/* Practice Identity */}
            <Section title="Practice Identity">
              <Field label="Practice Name">
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                />
              </Field>
              <Field label="Practice Type">
                <select
                  className={selectCls}
                  value={form.type ?? ''}
                  onChange={(e) => set('type', e.target.value || null)}
                >
                  <option value="">— Select type —</option>
                  {PRACTICE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </Section>

            {/* Contact Info */}
            <Section title="Contact Information">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone">
                  <input
                    className={inputCls}
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={form.phone ?? ''}
                    onChange={(e) => set('phone', e.target.value || null)}
                  />
                </Field>
                <Field label="Email">
                  <input
                    className={inputCls}
                    type="email"
                    placeholder="contact@practice.com"
                    value={form.email ?? ''}
                    onChange={(e) => set('email', e.target.value || null)}
                  />
                </Field>
              </div>
              <Field label="Website">
                <input
                  className={inputCls}
                  type="url"
                  placeholder="https://www.yourpractice.com"
                  value={form.website ?? ''}
                  onChange={(e) => set('website', e.target.value || null)}
                />
              </Field>
              <Field label="Street Address">
                <input
                  className={inputCls}
                  placeholder="123 Main St"
                  value={form.address ?? ''}
                  onChange={(e) => set('address', e.target.value || null)}
                />
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field label="City">
                  <input
                    className={inputCls}
                    placeholder="New York"
                    value={form.city ?? ''}
                    onChange={(e) => set('city', e.target.value || null)}
                  />
                </Field>
                <Field label="State">
                  <select
                    className={selectCls}
                    value={form.state ?? ''}
                    onChange={(e) => set('state', e.target.value || null)}
                  >
                    <option value="">—</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="ZIP">
                  <input
                    className={inputCls}
                    placeholder="10001"
                    maxLength={10}
                    value={form.zip ?? ''}
                    onChange={(e) => set('zip', e.target.value || null)}
                  />
                </Field>
              </div>
            </Section>

            {/* Branding */}
            <Section title="Branding">
              <Field label="Logo URL">
                <input
                  className={inputCls}
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={form.logoUrl ?? ''}
                  onChange={(e) => set('logoUrl', e.target.value || null)}
                />
              </Field>
              {form.logoUrl && (
                <img
                  src={form.logoUrl}
                  alt="Practice logo preview"
                  className="h-16 w-auto rounded-lg border border-gray-200 object-contain bg-white p-2"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <Field label="Brand Color">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.brandColor ?? '#1D9E75'}
                    onChange={(e) => set('brandColor', e.target.value)}
                    className="h-9 w-14 rounded-lg border border-gray-200 cursor-pointer p-1"
                  />
                  <input
                    className={inputCls + ' font-mono uppercase w-32'}
                    maxLength={7}
                    value={form.brandColor ?? ''}
                    onChange={(e) => set('brandColor', e.target.value || null)}
                    placeholder="#1D9E75"
                  />
                  <div
                    className="h-9 w-9 rounded-lg border border-gray-200 flex-shrink-0"
                    style={{ backgroundColor: form.brandColor ?? '#1D9E75' }}
                  />
                </div>
              </Field>
            </Section>

            {/* Payroll Schedule */}
            <Section title="Payroll Schedule">
              <Field label="Pay Period">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PAYROLL_PERIODS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => set('payrollPeriod', p.value)}
                      className={`rounded-xl border-2 px-3 py-3 text-left transition-all ${
                        form.payrollPeriod === p.value
                          ? 'border-[#1D9E75] bg-[#F0FAF6]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${form.payrollPeriod === p.value ? 'text-[#1D9E75]' : 'text-gray-800'}`}>
                        {p.label}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </Field>

              {form.payrollPeriod && (
                <>
                  {(form.payrollPeriod === 'weekly' || form.payrollPeriod === 'biweekly') && (
                    <Field label="Pay Day">
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day, idx) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => set('payrollStartDay', idx)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-all ${
                              form.payrollStartDay === idx
                                ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                                : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'
                            }`}
                          >
                            {day.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    </Field>
                  )}

                  {form.payrollPeriod === 'semimonthly' && (
                    <Field label="First Pay Date of Month">
                      <div className="flex flex-wrap gap-2">
                        {[1,5,10,15].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => set('payrollStartDay', d)}
                            className={`rounded-lg px-4 py-1.5 text-sm font-medium border transition-all ${
                              form.payrollStartDay === d
                                ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                                : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'
                            }`}
                          >
                            {d === 1 ? '1st' : d === 5 ? '5th' : d === 10 ? '10th' : '15th'}
                          </button>
                        ))}
                        <span className="self-center text-xs text-gray-400">
                          {form.payrollStartDay
                            ? `→ pays on the ${form.payrollStartDay}${['','st','nd','rd'][form.payrollStartDay] ?? 'th'} & ${form.payrollStartDay + 15}${form.payrollStartDay + 15 > 28 ? ' (last day)' : 'th'}`
                            : ''}
                        </span>
                      </div>
                    </Field>
                  )}

                  {form.payrollPeriod === 'monthly' && (
                    <Field label="Pay Date (day of month)">
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={28}
                          className={inputCls + ' w-24'}
                          placeholder="1–28"
                          value={form.payrollStartDay ?? ''}
                          onChange={(e) => set('payrollStartDay', parseInt(e.target.value) || null)}
                        />
                        <span className="text-xs text-gray-400">day of each month</span>
                      </div>
                    </Field>
                  )}

                  <Field label="Next Pay Date">
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        className={inputCls + ' w-48'}
                        value={form.payrollNextDate ? form.payrollNextDate.split('T')[0] : ''}
                        onChange={(e) => set('payrollNextDate', e.target.value || null)}
                      />
                      <span className="text-xs text-gray-400">anchors future pay periods</span>
                    </div>
                  </Field>
                </>
              )}
            </Section>

            {/* HR Settings */}
            <Section title="HR Settings">
              <Field label="Default PTO Days Per Year">
                <input
                  className={inputCls + ' w-24'}
                  type="number"
                  min={0}
                  max={365}
                  value={form.defaultPtoDays}
                  onChange={(e) => set('defaultPtoDays', parseInt(e.target.value) || 0)}
                />
              </Field>
              <Toggle
                label="Allow per-staff custom PTO allocation"
                description="Managers can set individual PTO days that override the practice default."
                checked={form.ptoCustomAllowed}
                onChange={(v) => set('ptoCustomAllowed', v)}
              />
              <Toggle
                label="Require specialty on clock-in"
                description="Staff must select a specialty when clocking in at this practice."
                checked={form.requireSpecialty}
                onChange={(v) => set('requireSpecialty', v)}
              />
            </Section>

            {/* Benefits Plans */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Benefits Plans</h2>
                <p className="text-xs text-gray-400">Visible to staff in their profile</p>
              </div>
              <div className="divide-y divide-gray-100">
                {benefits.map(b => {
                  const f = benefitForms[b.id]
                  const isOpen = expandedBenefitId === b.id
                  const isSaving = benefitSaving === b.id
                  const isDeleting = deletingBenefitId === b.id
                  const hasDetails = !!(b.providerName || b.phone || b.email || b.website)
                  return (
                    <div key={b.id}>
                      <button
                        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedBenefitId(isOpen ? null : b.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{b.name}</p>
                          {hasDetails && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {[b.providerName, b.phone, b.email].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {!hasDetails && (
                            <p className="text-xs text-gray-300 mt-0.5">No provider details added</p>
                          )}
                        </div>
                        <svg
                          className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          width="16" height="16" viewBox="0 0 16 16" fill="none"
                        >
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      {isOpen && f && (
                        <div className="px-6 pb-5 pt-1 bg-[#FAFAF8] border-t border-gray-100 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-gray-500">Plan / Benefit Name</label>
                              <input
                                className={inputCls}
                                value={f.name}
                                onChange={e => setBenefitField(b.id, 'name', e.target.value)}
                                placeholder="e.g. Health Insurance"
                              />
                            </div>
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-gray-500">Provider / Company Name</label>
                              <input
                                className={inputCls}
                                value={f.providerName}
                                onChange={e => setBenefitField(b.id, 'providerName', e.target.value)}
                                placeholder="e.g. Blue Cross Blue Shield"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-gray-500">Support Phone</label>
                              <input
                                className={inputCls}
                                type="tel"
                                value={f.phone}
                                onChange={e => setBenefitField(b.id, 'phone', e.target.value)}
                                placeholder="(800) 000-0000"
                              />
                            </div>
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-gray-500">Support Email</label>
                              <input
                                className={inputCls}
                                type="email"
                                value={f.email}
                                onChange={e => setBenefitField(b.id, 'email', e.target.value)}
                                placeholder="support@provider.com"
                              />
                            </div>
                          </div>
                          <div className="grid gap-1">
                            <label className="text-xs font-medium text-gray-500">Website / Portal URL</label>
                            <input
                              className={inputCls}
                              type="url"
                              value={f.website}
                              onChange={e => setBenefitField(b.id, 'website', e.target.value)}
                              placeholder="https://member.provider.com"
                            />
                          </div>
                          <div className="grid gap-1">
                            <label className="text-xs font-medium text-gray-500">Notes</label>
                            <textarea
                              className={inputCls + ' resize-none'}
                              rows={2}
                              value={f.notes}
                              onChange={e => setBenefitField(b.id, 'notes', e.target.value)}
                              placeholder="Group number, plan name, enrollment instructions…"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => saveBenefit(b.id)}
                              disabled={isSaving}
                              className="rounded-lg bg-[#1D9E75] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {isSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={() => setExpandedBenefitId(null)}
                              className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            {!b.isDefault && (
                              <button
                                onClick={() => deleteBenefit(b.id)}
                                disabled={isDeleting}
                                className="ml-auto rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {isDeleting ? 'Removing…' : 'Remove'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add new benefit */}
                <div className="px-6 py-4 flex items-center gap-3">
                  <input
                    className={inputCls + ' flex-1'}
                    placeholder="Add benefit (e.g. Commuter Benefits, Dental Plan, Vision…)"
                    value={newBenefitName}
                    onChange={e => setNewBenefitName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addBenefit() }}
                  />
                  <button
                    onClick={addBenefit}
                    disabled={!newBenefitName.trim() || addingBenefit}
                    className="shrink-0 rounded-lg bg-[#1D9E75] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {addingBenefit ? 'Adding…' : '+ Add'}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              {error && <p className="text-sm text-red-500">{error}</p>}
              {saved && !error && <p className="text-sm text-[#1D9E75] font-medium">Changes saved.</p>}
              {!error && !saved && <span />}
              <button
                onClick={save}
                disabled={saving}
                className="ml-auto rounded-xl bg-[#1D9E75] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#178a64] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors ${checked ? 'bg-[#1D9E75]' : 'bg-gray-200'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}
