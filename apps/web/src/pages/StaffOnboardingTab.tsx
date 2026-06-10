import { useEffect, useState } from 'react'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EquipmentItem {
  id: string
  name: string
  serialNumber: string | null
  assignedAt: string
  returnedAt: string | null
  notes: string | null
}

interface Checklist {
  id: string
  userId: string
  i9CompletedAt: string | null
  w4CompletedAt: string | null
  personalInfoCompletedAt: string | null
  emergencyContactCompletedAt: string | null
  directDepositCompletedAt: string | null
  i9Data: Record<string, unknown> | null
  i9Section2Data: Record<string, unknown> | null
  i9Section2CompletedAt: string | null
  w4Data: Record<string, unknown> | null
  personalInfoData: Record<string, unknown> | null
  emergencyContactData: Record<string, unknown> | null
  directDepositData: Record<string, unknown> | null
  equipmentItems: EquipmentItem[]
  completionPct: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FORM_FIELD_LABELS: Record<string, Record<string, string>> = {
  i9: {
    lastName: 'Last Name', firstName: 'First Name', middleInitial: 'M.I.',
    otherLastNames: 'Other Last Names', address: 'Address', aptNumber: 'Apt #',
    city: 'City', state: 'State', zip: 'ZIP',
    dob: 'Date of Birth', ssn4: 'Last 4 SSN', email: 'Email', phone: 'Phone',
    citizenshipStatus: 'Citizenship Status', alienNumber: 'Alien/USCIS No.',
    i94Number: 'I-94 Number', foreignPassport: 'Foreign Passport',
    countryOfIssuance: 'Country of Issuance', workAuthExpiry: 'Work Auth Expiry',
    signatureName: 'Electronic Signature', signatureDate: 'Signed On',
  },
  w4: {
    firstName: 'First Name & M.I.', lastName: 'Last Name', ssn4: 'Last 4 SSN',
    address: 'Address', city: 'City', state: 'State', zip: 'ZIP',
    filingStatus: 'Filing Status', multipleJobs: 'Multiple Jobs',
    qualifyingChildren: 'Qualifying Children ($)', otherDependents: 'Other Dependents ($)',
    totalDependents: 'Total Dependents ($)', otherIncome: 'Other Income ($)',
    deductions: 'Deductions ($)', extraWithholding: 'Extra Withholding ($)',
    signatureName: 'Electronic Signature', signatureDate: 'Signed On',
  },
  'personal-info': {
    firstName: 'First Name', lastName: 'Last Name',
    phone: 'Phone', email: 'Email Address', address: 'Home Address',
    city: 'City', state: 'State', zip: 'Zip',
    dob: 'Date of Birth', birthdayPrivacy: 'Birthday Preference',
  },
  'emergency-contact': {
    name: 'Contact Name', relationship: 'Relationship',
    primaryPhone: 'Primary Phone', altPhone: 'Alternate Phone',
  },
  'direct-deposit': {
    bankName: 'Bank Name', accountType: 'Account Type',
    routingNumber: 'Routing Number', accountNumber: 'Account Number',
  },
}

const MASKED_FIELDS = new Set(['ssn4', 'routingNumber', 'accountNumber'])

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (MASKED_FIELDS.has(key)) {
    const s = String(value)
    return '•'.repeat(Math.max(0, s.length - 2)) + s.slice(-2)
  }
  if (key === 'signatureDate') return fmtDate(String(value)) ?? String(value)
  if (key === 'dob') {
    const d = String(value).replace(/\D/g, '')
    if (d.length === 8) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
    return String(value)
  }
  if (key === 'birthdayPrivacy') return value === 'private' ? 'Keep private' : 'Celebrate with team'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2.5 border ${done ? 'bg-[#E8F5F0] border-[#B8DFD0]' : 'bg-gray-50 border-gray-200'}`}>
      <span className={`text-lg leading-none ${done ? 'text-[#1D9E75]' : 'text-gray-300'}`}>{done ? '✓' : '○'}</span>
      <span className={`text-[10px] font-semibold text-center leading-tight ${done ? 'text-[#1D9E75]' : 'text-gray-400'}`}>{label}</span>
    </div>
  )
}

function FormDataPanel({ formKey, label, data, date }: {
  formKey: string; label: string
  data: Record<string, unknown> | null; date: string | null
}) {
  const [open, setOpen] = useState(false)
  const labelMap = FORM_FIELD_LABELS[formKey] ?? {}
  const done = !!date

  return (
    <div className={`rounded-xl border ${done ? 'border-[#B8DFD0]' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className={`text-base leading-none ${done ? 'text-[#1D9E75]' : 'text-gray-300'}`}>{done ? '✓' : '○'}</span>
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          {done && <span className="text-xs text-gray-400">{fmtDate(date)}</span>}
        </div>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {data ? (
            <dl className="mt-3 space-y-1.5">
              {Object.entries(labelMap).map(([key, fieldLabel]) => {
                const val = data[key]
                if (val === undefined) return null
                return (
                  <div key={key} className="flex justify-between gap-2 text-xs border-b border-gray-50 pb-1 last:border-0">
                    <dt className="text-gray-500 shrink-0">{fieldLabel}</dt>
                    <dd className={`text-gray-800 font-medium text-right ${key === 'signatureName' ? 'italic' : ''}`}>
                      {formatFieldValue(key, val)}
                    </dd>
                  </div>
                )
              })}
            </dl>
          ) : (
            <p className="mt-3 text-xs text-gray-400 italic">No data submitted yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  userId: string
  firstName: string
}

export default function StaffOnboardingTab({ userId, firstName }: Props) {
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [loading, setLoading] = useState(true)

  // Equipment form
  const [equipForm, setEquipForm] = useState<{ name: string; serial: string; notes: string } | null>(null)
  const [savingEquip, setSavingEquip] = useState(false)

  // Section 2 form
  const [showSec2, setShowSec2] = useState(false)
  const [sec2Form, setSec2Form] = useState({
    listType: 'A',
    listATitle: '', listAAuthority: '', listANumber: '', listAExpiry: '',
    listBTitle: '', listBAuthority: '', listBNumber: '', listBExpiry: '',
    listCTitle: '', listCAuthority: '', listCNumber: '', listCExpiry: '',
    dateHire: '', employerName: '', employerTitle: '', employerOrg: '', employerAddress: '',
    signatureName: '',
  })
  const [savingSec2, setSavingSec2] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/onboarding?practiceId=${PRACTICE_ID}&userId=${userId}`)
      const data = await res.json()
      if (data?.id) setChecklist(data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [userId])

  async function addEquipment() {
    if (!equipForm || !equipForm.name.trim() || !checklist) return
    setSavingEquip(true)
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: PRACTICE_ID, userId,
          name: equipForm.name.trim(),
          serialNumber: equipForm.serial.trim() || undefined,
          notes: equipForm.notes.trim() || undefined,
        }),
      })
      if (res.ok) { setEquipForm(null); load() }
    } finally { setSavingEquip(false) }
  }

  async function markReturned(itemId: string) {
    await fetch(`${API_BASE}/api/onboarding/equipment/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnedAt: new Date().toISOString() }),
    })
    load()
  }

  async function deleteEquipment(itemId: string) {
    if (!confirm('Remove this equipment record?')) return
    await fetch(`${API_BASE}/api/onboarding/equipment/${itemId}`, { method: 'DELETE' })
    load()
  }

  async function submitSection2() {
    if (!checklist) return
    setSavingSec2(true)
    try {
      const payload: Record<string, unknown> = {
        listType: sec2Form.listType,
        dateHire: sec2Form.dateHire,
        employerName: sec2Form.employerName,
        employerTitle: sec2Form.employerTitle,
        employerOrg: sec2Form.employerOrg,
        employerAddress: sec2Form.employerAddress,
        signatureName: sec2Form.signatureName,
        signatureDate: new Date().toISOString(),
      }
      if (sec2Form.listType === 'A') {
        payload.listA = { title: sec2Form.listATitle, authority: sec2Form.listAAuthority, number: sec2Form.listANumber, expiry: sec2Form.listAExpiry }
      } else {
        payload.listB = { title: sec2Form.listBTitle, authority: sec2Form.listBAuthority, number: sec2Form.listBNumber, expiry: sec2Form.listBExpiry }
        payload.listC = { title: sec2Form.listCTitle, authority: sec2Form.listCAuthority, number: sec2Form.listCNumber, expiry: sec2Form.listCExpiry }
      }
      const res = await fetch(`${API_BASE}/api/onboarding/i9-section2?practiceId=${PRACTICE_ID}&userId=${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) { setShowSec2(false); load() }
    } finally { setSavingSec2(false) }
  }

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Loading…</div>

  if (!checklist) return (
    <div className="py-12 text-center">
      <p className="text-sm text-gray-400">No onboarding record yet.</p>
      <p className="text-xs text-gray-300 mt-1">{firstName} needs to open the Brisa mobile app to start onboarding.</p>
    </div>
  )

  const overallPct = checklist.completionPct

  return (
    <div className="space-y-6 pb-8">

      {/* Overall progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Onboarding Progress</h3>
          <span className={`text-sm font-bold ${overallPct === 100 ? 'text-[#1D9E75]' : overallPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
            {overallPct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${overallPct === 100 ? 'bg-[#1D9E75]' : overallPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${overallPct}%` }}
          />
        </div>

        {/* Status pills */}
        <div className="grid grid-cols-6 gap-2 mt-3">
          <StatusPill done={!!(checklist.i9CompletedAt && checklist.i9Data?.signatureName)} label="I-9" />
          <StatusPill done={!!(checklist.w4CompletedAt && checklist.w4Data?.signatureName)} label="W-4" />
          <StatusPill done={!!(checklist.personalInfoCompletedAt && checklist.personalInfoData)} label="Personal" />
          <StatusPill done={!!(checklist.emergencyContactCompletedAt && checklist.emergencyContactData)} label="Emergency" />
          <StatusPill done={!!(checklist.directDepositCompletedAt && checklist.directDepositData)} label="Direct Dep" />
          <StatusPill done={checklist.equipmentItems.length > 0} label="Equipment" />
        </div>
      </div>

      {/* HR Forms — collapsible */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">HR Forms</h3>
        <div className="space-y-2">
          <FormDataPanel formKey="i9"                label="I-9 — Section 1"   data={checklist.i9Data}               date={checklist.i9CompletedAt} />
          <FormDataPanel formKey="w4"                label="W-4"               data={checklist.w4Data}               date={checklist.w4CompletedAt} />
          <FormDataPanel formKey="personal-info"     label="Personal Info"     data={checklist.personalInfoData}     date={checklist.personalInfoCompletedAt} />
          <FormDataPanel formKey="emergency-contact" label="Emergency Contact" data={checklist.emergencyContactData} date={checklist.emergencyContactCompletedAt} />
          <FormDataPanel formKey="direct-deposit"    label="Direct Deposit"    data={checklist.directDepositData}    date={checklist.directDepositCompletedAt} />
        </div>
      </div>

      {/* I-9 Section 2 — Employer Attestation */}
      {checklist.i9CompletedAt && (
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">I-9 Section 2 — Employer Attestation</h3>
          <div className={`rounded-xl border-2 p-4 ${checklist.i9Section2CompletedAt ? 'border-[#1D9E75] bg-[#F0FAF6]' : 'border-amber-300 bg-amber-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">
                {checklist.i9Section2CompletedAt
                  ? `✓ Attested on ${fmtDate(checklist.i9Section2CompletedAt)}`
                  : 'Awaiting employer review & attestation'}
              </p>
              {!checklist.i9Section2CompletedAt && (
                <button
                  onClick={() => setShowSec2(v => !v)}
                  className="text-xs font-semibold bg-[#1D9E75] text-white rounded-lg px-3 py-1.5 hover:opacity-90"
                >
                  {showSec2 ? 'Cancel' : '+ Complete Section 2'}
                </button>
              )}
            </div>

            {checklist.i9Section2Data && !showSec2 && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                {Object.entries(checklist.i9Section2Data)
                  .filter(([k]) => !['listA','listB','listC','signatureDate','listType'].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-gray-100 py-0.5">
                      <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-medium text-gray-800">{String(v)}</span>
                    </div>
                  ))}
              </div>
            )}

            {showSec2 && !checklist.i9Section2CompletedAt && (
              <div className="mt-3 pt-3 border-t border-amber-200 space-y-4">
                {/* List type */}
                <div className="flex gap-2">
                  {(['A', 'BC'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setSec2Form(f => ({ ...f, listType: t }))}
                      className={`text-xs rounded-lg px-3 py-1.5 font-medium border ${sec2Form.listType === t ? 'bg-[#1D9E75] text-white border-[#1D9E75]' : 'border-gray-300 text-gray-600'}`}
                    >
                      {t === 'A' ? 'List A (one doc)' : 'List B + C (two docs)'}
                    </button>
                  ))}
                </div>

                {sec2Form.listType === 'A' && (
                  <div className="grid grid-cols-2 gap-2">
                    {[['listATitle','Document Title *'],['listAAuthority','Issuing Authority *'],['listANumber','Document Number *'],['listAExpiry','Expiration Date']].map(([k, lbl]) => (
                      <div key={k}>
                        <label className="text-xs text-gray-500 block mb-1">{lbl}</label>
                        <input value={(sec2Form as Record<string,string>)[k]} onChange={e => setSec2Form(f => ({ ...f, [k]: e.target.value }))}
                          className="border rounded-lg px-2.5 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#1D9E75]" />
                      </div>
                    ))}
                  </div>
                )}
                {sec2Form.listType === 'BC' && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500">List B — Identity</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[['listBTitle','Title *'],['listBAuthority','Authority *'],['listBNumber','Number *'],['listBExpiry','Expiry']].map(([k, lbl]) => (
                        <div key={k}>
                          <label className="text-xs text-gray-500 block mb-1">{lbl}</label>
                          <input value={(sec2Form as Record<string,string>)[k]} onChange={e => setSec2Form(f => ({ ...f, [k]: e.target.value }))}
                            className="border rounded-lg px-2.5 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#1D9E75]" />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-gray-500">List C — Employment Authorization</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[['listCTitle','Title *'],['listCAuthority','Authority *'],['listCNumber','Number *'],['listCExpiry','Expiry']].map(([k, lbl]) => (
                        <div key={k}>
                          <label className="text-xs text-gray-500 block mb-1">{lbl}</label>
                          <input value={(sec2Form as Record<string,string>)[k]} onChange={e => setSec2Form(f => ({ ...f, [k]: e.target.value }))}
                            className="border rounded-lg px-2.5 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#1D9E75]" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {[['employerName','Your Full Name *'],['employerTitle','Your Title *'],['employerOrg','Organization *'],['employerAddress','Business Address'],['dateHire','Employee First Day *']].map(([k, lbl]) => (
                    <div key={k}>
                      <label className="text-xs text-gray-500 block mb-1">{lbl}</label>
                      <input value={(sec2Form as Record<string,string>)[k]} onChange={e => setSec2Form(f => ({ ...f, [k]: e.target.value }))}
                        className="border rounded-lg px-2.5 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#1D9E75]" />
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-amber-100 border border-amber-200 p-3 text-xs text-amber-800">
                  <strong>Certification:</strong> I attest, under penalty of perjury, that I have examined the documents presented and they appear genuine and relate to the employee named.
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Electronic Signature — type your full legal name *</label>
                  <input
                    value={sec2Form.signatureName}
                    onChange={e => setSec2Form(f => ({ ...f, signatureName: e.target.value }))}
                    placeholder="Full legal name"
                    className="border-2 border-[#1D9E75] rounded-lg px-3 py-2 text-sm w-full max-w-xs italic focus:outline-none"
                  />
                </div>

                <button
                  onClick={submitSection2}
                  disabled={savingSec2 || !sec2Form.signatureName.trim()}
                  className="bg-[#1D9E75] text-white text-sm font-semibold rounded-lg px-6 py-2 hover:opacity-90 disabled:opacity-50"
                >
                  {savingSec2 ? 'Saving…' : 'Submit Section 2 Attestation'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Equipment */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Equipment</h3>
          <button
            onClick={() => setEquipForm(equipForm ? null : { name: '', serial: '', notes: '' })}
            className="text-xs font-semibold text-[#1D9E75] hover:underline"
          >
            + Add Equipment
          </button>
        </div>

        {equipForm && (
          <div className="mb-3 flex flex-wrap gap-2 items-end rounded-xl bg-gray-50 p-3 border border-gray-200">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Item Name *</label>
              <input type="text" value={equipForm.name} onChange={e => setEquipForm(f => f && ({ ...f, name: e.target.value }))}
                placeholder="e.g. MacBook Pro"
                className="border rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-[#1D9E75]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Serial #</label>
              <input type="text" value={equipForm.serial} onChange={e => setEquipForm(f => f && ({ ...f, serial: e.target.value }))}
                placeholder="Optional"
                className="border rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-[#1D9E75]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Notes</label>
              <input type="text" value={equipForm.notes} onChange={e => setEquipForm(f => f && ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
                className="border rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-[#1D9E75]" />
            </div>
            <button onClick={addEquipment} disabled={savingEquip || !equipForm.name.trim()}
              className="bg-[#1D9E75] text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90 disabled:opacity-50">
              {savingEquip ? '…' : 'Add'}
            </button>
            <button onClick={() => setEquipForm(null)} className="text-sm text-gray-400 hover:text-gray-700">Cancel</button>
          </div>
        )}

        {checklist.equipmentItems.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No equipment assigned.</p>
        ) : (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {checklist.equipmentItems.map((item, idx) => (
              <div key={item.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.serialNumber ? `S/N: ${item.serialNumber}` : ''}{item.notes ? ` · ${item.notes}` : ''}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">Assigned {fmtDate(item.assignedAt)}</span>
                {item.returnedAt
                  ? <span className="text-xs text-amber-600 shrink-0">Returned {fmtDate(item.returnedAt)}</span>
                  : <span className="text-xs text-[#1D9E75] font-medium shrink-0">Active</span>}
                <div className="flex gap-2 shrink-0">
                  {!item.returnedAt && (
                    <button onClick={() => markReturned(item.id)} className="text-xs text-amber-600 hover:underline">Returned</button>
                  )}
                  <button onClick={() => deleteEquipment(item.id)} className="text-xs text-red-400 hover:underline">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
