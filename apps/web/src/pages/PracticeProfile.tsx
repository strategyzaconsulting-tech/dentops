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

export default function PracticeProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const [form, setForm] = useState<PracticeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    apiFetch(`/api/practice/${user.practiceId}`)
      .then((r) => r.json())
      .then((data) => setForm(data))
      .catch(() => setError('Failed to load practice data.'))
      .finally(() => setLoading(false))
  }, [user])

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
