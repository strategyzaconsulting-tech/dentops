import { useEffect, useState } from 'react'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = 'http://localhost:3000'

// ─── Types ──────────────────────────────────────────────────────────────────

interface User {
  id: string
  firstName: string
  lastName: string
  role: string
  email: string
}

interface EquipmentItem {
  id: string
  userId: string
  onboardingId: string
  name: string
  serialNumber: string | null
  assignedAt: string
  returnedAt: string | null
  notes: string | null
}

interface Checklist {
  id: string
  userId: string
  user: User
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

interface ManualSignature {
  id: string
  userId: string
  signedAt: string
  user: { id: string; firstName: string; lastName: string }
}

interface OfficeManual {
  id: string
  title: string
  content: string
  version: string
  updatedAt: string
  signatures: ManualSignature[]
}

interface TrainingSession {
  id: string
  userId: string
  trainerId: string | null
  topic: string
  scheduledAt: string
  completedAt: string | null
  notes: string | null
  user: User
  trainer: User | null
}

interface StaffMember {
  id: string
  firstName: string
  lastName: string
  role: string
  email: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Check() {
  return <span className="text-[#1D9E75] font-bold text-lg">✓</span>
}

function Dash() {
  return <span className="text-gray-400">–</span>
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

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
  if (key === 'birthdayPrivacy') return value === 'private' ? '🔒 Keep private' : '🎉 Celebrate with team'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function FormDataPanel({ formKey, label, data, date }: {
  formKey: string
  label: string
  data: Record<string, unknown> | null
  date: string | null
}) {
  const labelMap = FORM_FIELD_LABELS[formKey] ?? {}
  const isSigned = data?.signatureName

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
        {date
          ? <span className="text-xs text-[#1D9E75] font-medium">✓ {fmtDate(date)}</span>
          : <span className="text-xs text-gray-400 italic">Not submitted</span>}
      </div>
      {data ? (
        <dl className="space-y-1.5">
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
          {isSigned && (
            <p className="text-xs text-[#1D9E75] pt-1">✓ Electronically signed</p>
          )}
        </dl>
      ) : (
        <p className="text-xs text-gray-400 italic mt-1">No data submitted yet</p>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Onboarding() {
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [manual, setManual] = useState<OfficeManual | null>(null)
  const [training, setTraining] = useState<TrainingSession[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  // Expanded row state
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Equipment form state
  const [equipForm, setEquipForm] = useState<{
    userId: string; name: string; serial: string; notes: string
  } | null>(null)

  // I-9 Section 2 form state
  const [sec2UserId, setSec2UserId] = useState<string | null>(null)
  const [sec2Form, setSec2Form] = useState({
    listType: 'A',
    listATitle: '', listAAuthority: '', listANumber: '', listAExpiry: '',
    listBTitle: '', listBAuthority: '', listBNumber: '', listBExpiry: '',
    listCTitle: '', listCAuthority: '', listCNumber: '', listCExpiry: '',
    dateHire: '', employerName: '', employerTitle: '', employerOrg: '', employerAddress: '',
    signatureName: '',
  })
  const [savingSec2, setSavingSec2] = useState(false)

  // Manual tab
  const [activeTab, setActiveTab] = useState<'manual' | 'training'>('manual')
  const [manualForm, setManualForm] = useState({ title: '', content: '', version: '' })
  const [savingManual, setSavingManual] = useState(false)
  const [manualSaved, setManualSaved] = useState(false)

  // Training form state
  const [trainingForm, setTrainingForm] = useState({
    userId: '', trainerId: '', topic: '', scheduledAt: '',
  })
  const [savingTraining, setSavingTraining] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [cl, man, tr, st] = await Promise.allSettled([
        fetch(`${API_BASE}/api/onboarding/all?practiceId=${PRACTICE_ID}`).then((r) => r.json()),
        fetch(`${API_BASE}/api/office-manual?practiceId=${PRACTICE_ID}`).then((r) => r.json()),
        fetch(`${API_BASE}/api/training/all?practiceId=${PRACTICE_ID}`).then((r) => r.json()),
        fetch(`${API_BASE}/api/staff?practiceId=${PRACTICE_ID}`).then((r) => r.json()),
      ])
      if (cl.status === 'fulfilled' && Array.isArray(cl.value)) setChecklists(cl.value)
      if (man.status === 'fulfilled' && man.value?.id) {
        setManual(man.value)
        setManualForm({ title: man.value.title, content: man.value.content, version: man.value.version })
      }
      if (tr.status === 'fulfilled' && Array.isArray(tr.value)) setTraining(tr.value)
      if (st.status === 'fulfilled' && Array.isArray(st.value)) setStaff(st.value)
    } finally {
      setLoading(false)
    }
  }

  // ─── Equipment handlers ────────────────────────────────────────────────────

  async function addEquipment(userId: string, _onboardingId: string) {
    if (!equipForm || !equipForm.name.trim()) return
    const res = await fetch(`${API_BASE}/api/onboarding/equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceId: PRACTICE_ID,
        userId,
        name: equipForm.name.trim(),
        serialNumber: equipForm.serial.trim() || undefined,
        notes: equipForm.notes.trim() || undefined,
      }),
    })
    if (res.ok) {
      setEquipForm(null)
      loadAll()
    }
  }

  async function markReturned(itemId: string) {
    await fetch(`${API_BASE}/api/onboarding/equipment/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnedAt: new Date().toISOString() }),
    })
    loadAll()
  }

  async function deleteEquipment(itemId: string) {
    await fetch(`${API_BASE}/api/onboarding/equipment/${itemId}`, { method: 'DELETE' })
    loadAll()
  }

  // ─── I-9 Section 2 handler ────────────────────────────────────────────────

  async function submitSection2(userId: string) {
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
      if (res.ok) { setSec2UserId(null); loadAll() }
    } finally {
      setSavingSec2(false)
    }
  }

  // ─── Manual handlers ───────────────────────────────────────────────────────

  async function saveManual() {
    if (!manualForm.title.trim() || !manualForm.content.trim()) return
    setSavingManual(true)
    try {
      await fetch(`${API_BASE}/api/office-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: PRACTICE_ID, ...manualForm }),
      })
      setManualSaved(true)
      setTimeout(() => setManualSaved(false), 2500)
      loadAll()
    } finally {
      setSavingManual(false)
    }
  }

  // ─── Training handlers ─────────────────────────────────────────────────────

  async function addTrainingSession() {
    if (!trainingForm.userId || !trainingForm.topic || !trainingForm.scheduledAt) return
    setSavingTraining(true)
    try {
      await fetch(`${API_BASE}/api/training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: PRACTICE_ID,
          userId: trainingForm.userId,
          trainerId: trainingForm.trainerId || undefined,
          topic: trainingForm.topic,
          scheduledAt: trainingForm.scheduledAt,
        }),
      })
      setTrainingForm({ userId: '', trainerId: '', topic: '', scheduledAt: '' })
      loadAll()
    } finally {
      setSavingTraining(false)
    }
  }

  async function deleteTraining(id: string) {
    await fetch(`${API_BASE}/api/training/${id}`, { method: 'DELETE' })
    loadAll()
  }

  async function markTrainingComplete(id: string) {
    await fetch(`${API_BASE}/api/training/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: new Date().toISOString() }),
    })
    loadAll()
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
        <p className="text-muted-foreground">Loading onboarding data…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-[#2C3E3A]">
        <div className="container flex h-16 items-center gap-4">
          <a href="/" className="text-sm text-[#8BAF9A] hover:text-white">← Back</a>
          <h1 className="text-xl font-bold text-[#1D9E75]">Onboarding</h1>
          <span className="text-sm text-muted-foreground">Staff HR Forms, Training &amp; Manual</span>
        </div>
      </header>

      <main className="container py-8 space-y-10">

        {/* ── Staff Progress Table ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Staff Onboarding Progress</h2>
          {checklists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No onboarding records yet. Records are created when staff open the mobile app.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Name</th>
                    <th className="text-left px-4 py-3 font-semibold">Role</th>
                    <th className="text-center px-3 py-3 font-semibold">I-9</th>
                    <th className="text-center px-3 py-3 font-semibold">W-4</th>
                    <th className="text-center px-3 py-3 font-semibold">Personal</th>
                    <th className="text-center px-3 py-3 font-semibold">Emergency</th>
                    <th className="text-center px-3 py-3 font-semibold">Direct Dep</th>
                    <th className="text-center px-3 py-3 font-semibold">Equipment</th>
                    <th className="text-center px-3 py-3 font-semibold">Manual</th>
                    <th className="text-center px-3 py-3 font-semibold">Training</th>
                    <th className="text-center px-3 py-3 font-semibold">Overall %</th>
                  </tr>
                </thead>
                <tbody>
                  {checklists.map((c) => {
                    const manualSigned = manual?.signatures.some((s) => s.userId === c.userId) ?? false
                    const trainingCount = training.filter((t) => t.userId === c.userId && t.completedAt).length
                    const isExpanded = expandedId === c.id
                    return (
                      <>
                        <tr
                          key={c.id}
                          className="border-t hover:bg-muted/30 cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        >
                          <td className="px-4 py-3 font-medium">
                            {c.user.firstName} {c.user.lastName}
                            <span className="ml-2 text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground capitalize">{c.user.role}</td>
                          <td className="px-3 py-3 text-center">{c.i9CompletedAt && c.i9Data?.signatureName ? <Check /> : <Dash />}</td>
                          <td className="px-3 py-3 text-center">{c.w4CompletedAt && c.w4Data?.signatureName ? <Check /> : <Dash />}</td>
                          <td className="px-3 py-3 text-center">{c.personalInfoCompletedAt && c.personalInfoData && Object.keys(c.personalInfoData).length > 0 ? <Check /> : <Dash />}</td>
                          <td className="px-3 py-3 text-center">{c.emergencyContactCompletedAt && c.emergencyContactData && Object.keys(c.emergencyContactData).length > 0 ? <Check /> : <Dash />}</td>
                          <td className="px-3 py-3 text-center">{c.directDepositCompletedAt && c.directDepositData && Object.keys(c.directDepositData).length > 0 ? <Check /> : <Dash />}</td>
                          <td className="px-3 py-3 text-center">{c.equipmentItems.length > 0 ? <Check /> : <Dash />}</td>
                          <td className="px-3 py-3 text-center">{manualSigned ? <Check /> : <Dash />}</td>
                          <td className="px-3 py-3 text-center">{trainingCount > 0 ? <span className="text-[#1D9E75] font-semibold">{trainingCount}</span> : <Dash />}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`font-semibold ${c.completionPct === 100 ? 'text-[#1D9E75]' : c.completionPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                              {c.completionPct}%
                            </span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${c.id}-expanded`} className="border-t bg-muted/20">
                            <td colSpan={11} className="px-6 py-4">
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                <FormDataPanel formKey="i9"                label="I-9 — Section 1"   data={c.i9Data}               date={c.i9CompletedAt} />
                                <FormDataPanel formKey="w4"                label="W-4"               data={c.w4Data}               date={c.w4CompletedAt} />
                                <FormDataPanel formKey="personal-info"     label="Personal Info"     data={c.personalInfoData}     date={c.personalInfoCompletedAt} />
                                <FormDataPanel formKey="emergency-contact" label="Emergency Contact" data={c.emergencyContactData} date={c.emergencyContactCompletedAt} />
                                <FormDataPanel formKey="direct-deposit"    label="Direct Deposit"    data={c.directDepositData}    date={c.directDepositCompletedAt} />
                              </div>

                              {/* I-9 Section 2 — Employer Attestation */}
                              {c.i9CompletedAt && (
                                <div className="mt-4 rounded-lg border-2 border-[#1D9E75] bg-white p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <p className="font-bold text-[#1D9E75] text-sm">I-9 Section 2 — Employer Review & Attestation</p>
                                      <p className="text-xs text-gray-500 mt-0.5">Employer or authorized representative must physically verify documents and sign.</p>
                                    </div>
                                    {c.i9Section2CompletedAt ? (
                                      <span className="text-xs bg-green-100 text-green-700 font-semibold px-3 py-1 rounded-full">
                                        ✓ Attested {fmtDate(c.i9Section2CompletedAt)}
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => setSec2UserId(sec2UserId === c.userId ? null : c.userId)}
                                        className="text-sm bg-[#1D9E75] text-white rounded-lg px-4 py-1.5 hover:bg-[#178a65]"
                                      >
                                        {sec2UserId === c.userId ? 'Cancel' : '+ Complete Section 2'}
                                      </button>
                                    )}
                                  </div>

                                  {/* Show existing Section 2 data */}
                                  {c.i9Section2Data && (
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-2">
                                      {Object.entries(c.i9Section2Data).filter(([k]) => k !== 'listA' && k !== 'listB' && k !== 'listC' && k !== 'signatureDate' && k !== 'listType').map(([k, v]) => (
                                        <div key={k} className="flex justify-between border-b border-gray-50 py-0.5">
                                          <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                                          <span className="font-medium text-gray-800">{String(v)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Section 2 form */}
                                  {sec2UserId === c.userId && !c.i9Section2CompletedAt && (
                                    <div className="mt-3 pt-3 border-t space-y-3">
                                      {/* Document list selector */}
                                      <div>
                                        <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Document(s) Examined</p>
                                        <div className="flex gap-2 mb-3">
                                          {['A', 'BC'].map((t) => (
                                            <button key={t} onClick={() => setSec2Form({ ...sec2Form, listType: t })}
                                              className={`text-xs rounded px-3 py-1.5 font-medium border ${sec2Form.listType === t ? 'bg-[#1D9E75] text-white border-[#1D9E75]' : 'border-gray-300 text-gray-600'}`}>
                                              {t === 'A' ? 'List A (one document)' : 'List B + C (two documents)'}
                                            </button>
                                          ))}
                                        </div>

                                        {sec2Form.listType === 'A' && (
                                          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                            {[['listATitle','Document Title *'],['listAAuthority','Issuing Authority *'],['listANumber','Document Number *'],['listAExpiry','Expiration Date']].map(([k, lbl]) => (
                                              <div key={k}>
                                                <label className="text-xs text-gray-500 block mb-1">{lbl}</label>
                                                <input value={(sec2Form as Record<string,string>)[k]} onChange={(e) => setSec2Form({ ...sec2Form, [k]: e.target.value })}
                                                  placeholder={lbl.replace(' *','')} className="border rounded px-2 py-1.5 text-xs w-full" />
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {sec2Form.listType === 'BC' && (
                                          <div className="space-y-2">
                                            <p className="text-xs font-semibold text-gray-500">List B — Identity</p>
                                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                              {[['listBTitle','Document Title *'],['listBAuthority','Issuing Authority *'],['listBNumber','Document Number *'],['listBExpiry','Expiration Date']].map(([k, lbl]) => (
                                                <div key={k}>
                                                  <label className="text-xs text-gray-500 block mb-1">{lbl}</label>
                                                  <input value={(sec2Form as Record<string,string>)[k]} onChange={(e) => setSec2Form({ ...sec2Form, [k]: e.target.value })}
                                                    placeholder={lbl.replace(' *','')} className="border rounded px-2 py-1.5 text-xs w-full" />
                                                </div>
                                              ))}
                                            </div>
                                            <p className="text-xs font-semibold text-gray-500">List C — Employment Authorization</p>
                                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                              {[['listCTitle','Document Title *'],['listCAuthority','Issuing Authority *'],['listCNumber','Document Number *'],['listCExpiry','Expiration Date']].map(([k, lbl]) => (
                                                <div key={k}>
                                                  <label className="text-xs text-gray-500 block mb-1">{lbl}</label>
                                                  <input value={(sec2Form as Record<string,string>)[k]} onChange={(e) => setSec2Form({ ...sec2Form, [k]: e.target.value })}
                                                    placeholder={lbl.replace(' *','')} className="border rounded px-2 py-1.5 text-xs w-full" />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Employer info */}
                                      <div>
                                        <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Employer / Authorized Representative</p>
                                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                          {[['employerName','Your Full Name *'],['employerTitle','Your Title *'],['employerOrg','Business / Organization Name *'],['employerAddress','Business Address'],['dateHire','Employee First Day of Employment *']].map(([k, lbl]) => (
                                            <div key={k}>
                                              <label className="text-xs text-gray-500 block mb-1">{lbl}</label>
                                              <input value={(sec2Form as Record<string,string>)[k]} onChange={(e) => setSec2Form({ ...sec2Form, [k]: e.target.value })}
                                                placeholder={lbl.replace(' *','')} className="border rounded px-2 py-1.5 text-xs w-full" />
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Attestation + signature */}
                                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                                        <strong>Certification:</strong> I attest, under penalty of perjury, that (1) I have examined the document(s) presented by the above-named employee, (2) the above-listed document(s) appear to be genuine and to relate to the employee named, and (3) to the best of my knowledge the employee is authorized to work in the United States.
                                      </div>
                                      <div>
                                        <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">Electronic Signature — Type your full legal name *</label>
                                        <input
                                          value={sec2Form.signatureName}
                                          onChange={(e) => setSec2Form({ ...sec2Form, signatureName: e.target.value })}
                                          placeholder="Full legal name"
                                          className="border-2 border-[#1D9E75] rounded px-3 py-2 text-sm w-full max-w-sm italic"
                                        />
                                      </div>
                                      <button
                                        onClick={() => submitSection2(c.userId)}
                                        disabled={savingSec2 || !sec2Form.signatureName.trim()}
                                        className="bg-[#1D9E75] text-white text-sm font-semibold rounded-lg px-6 py-2 hover:bg-[#178a65] disabled:opacity-50"
                                      >
                                        {savingSec2 ? 'Saving…' : 'Submit Section 2 Attestation'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Equipment Section ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Equipment Log</h2>
          <div className="space-y-4">
            {checklists.length === 0 && (
              <p className="text-sm text-muted-foreground">No staff records yet.</p>
            )}
            {checklists.map((c) => (
              <div key={c.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold">{c.user.firstName} {c.user.lastName}</p>
                  <button
                    onClick={() => setEquipForm(equipForm?.userId === c.userId ? null : { userId: c.userId, name: '', serial: '', notes: '' })}
                    className="text-sm text-[#1D9E75] hover:underline"
                  >
                    + Add Equipment
                  </button>
                </div>

                {c.equipmentItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No equipment assigned</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-xs uppercase">
                        <th className="text-left py-1">Item</th>
                        <th className="text-left py-1">Serial #</th>
                        <th className="text-left py-1">Assigned</th>
                        <th className="text-left py-1">Status</th>
                        <th className="text-left py-1">Notes</th>
                        <th className="py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.equipmentItems.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="py-2 font-medium">{item.name}</td>
                          <td className="py-2 text-muted-foreground">{item.serialNumber ?? '–'}</td>
                          <td className="py-2 text-muted-foreground">{fmtDate(item.assignedAt)}</td>
                          <td className="py-2">
                            {item.returnedAt
                              ? <span className="text-xs text-amber-600">Returned {fmtDate(item.returnedAt)}</span>
                              : <span className="text-xs text-[#1D9E75]">Active</span>}
                          </td>
                          <td className="py-2 text-muted-foreground text-xs">{item.notes ?? ''}</td>
                          <td className="py-2 text-right space-x-2">
                            {!item.returnedAt && (
                              <button onClick={() => markReturned(item.id)} className="text-xs text-amber-600 hover:underline">
                                Mark Returned
                              </button>
                            )}
                            <button onClick={() => deleteEquipment(item.id)} className="text-xs text-red-500 hover:underline">
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Add equipment form */}
                {equipForm?.userId === c.userId && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-2 items-end">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Item Name *</label>
                      <input
                        type="text"
                        value={equipForm.name}
                        onChange={(e) => setEquipForm({ ...equipForm, name: e.target.value })}
                        placeholder="e.g. MacBook Pro"
                        className="border rounded px-3 py-1.5 text-sm w-44"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Serial #</label>
                      <input
                        type="text"
                        value={equipForm.serial}
                        onChange={(e) => setEquipForm({ ...equipForm, serial: e.target.value })}
                        placeholder="Optional"
                        className="border rounded px-3 py-1.5 text-sm w-36"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                      <input
                        type="text"
                        value={equipForm.notes}
                        onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })}
                        placeholder="Optional"
                        className="border rounded px-3 py-1.5 text-sm w-44"
                      />
                    </div>
                    <button
                      onClick={() => addEquipment(c.userId, c.id)}
                      className="bg-[#1D9E75] text-white text-sm rounded px-4 py-1.5 hover:bg-[#178a65]"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setEquipForm(null)}
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Office Manual + Training Tabs ─────────────────────────────────── */}
        <section>
          <div className="flex gap-1 mb-4 border-b">
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${activeTab === 'manual' ? 'border-[#1D9E75] text-[#1D9E75]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Office Manual
            </button>
            <button
              onClick={() => setActiveTab('training')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${activeTab === 'training' ? 'border-[#1D9E75] text-[#1D9E75]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Training
            </button>
          </div>

          {/* Office Manual Tab */}
          {activeTab === 'manual' && (
            <div className="space-y-6">
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold mb-4">Edit Office Manual</h3>
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Title</label>
                      <input
                        type="text"
                        value={manualForm.title}
                        onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                        placeholder="Office Manual Title"
                        className="border rounded px-3 py-2 text-sm w-full"
                      />
                    </div>
                    <div className="w-28">
                      <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Version</label>
                      <input
                        type="text"
                        value={manualForm.version}
                        onChange={(e) => setManualForm({ ...manualForm, version: e.target.value })}
                        placeholder="1.0"
                        className="border rounded px-3 py-2 text-sm w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Content</label>
                    <textarea
                      value={manualForm.content}
                      onChange={(e) => setManualForm({ ...manualForm, content: e.target.value })}
                      placeholder="Enter office manual content here…"
                      rows={10}
                      className="border rounded px-3 py-2 text-sm w-full font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={saveManual}
                      disabled={savingManual}
                      className="bg-[#1D9E75] text-white text-sm rounded px-5 py-2 hover:bg-[#178a65] disabled:opacity-50"
                    >
                      {savingManual ? 'Saving…' : 'Save Manual'}
                    </button>
                    {manualSaved && <span className="text-sm text-[#1D9E75]">Saved successfully!</span>}
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold mb-3">Signatures</h3>
                {!manual || manual.signatures.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No one has signed the manual yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground text-xs uppercase">
                        <th className="text-left py-1">Name</th>
                        <th className="text-left py-1">Signed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manual.signatures.map((sig) => (
                        <tr key={sig.id} className="border-t">
                          <td className="py-2">{sig.user.firstName} {sig.user.lastName}</td>
                          <td className="py-2 text-muted-foreground">{fmtDate(sig.signedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Training Tab */}
          {activeTab === 'training' && (
            <div className="space-y-6">
              {/* Add session form */}
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold mb-4">Add Training Session</h3>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Staff Member *</label>
                    <select
                      value={trainingForm.userId}
                      onChange={(e) => setTrainingForm({ ...trainingForm, userId: e.target.value })}
                      className="border rounded px-3 py-2 text-sm"
                    >
                      <option value="">Select staff…</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Trainer</label>
                    <select
                      value={trainingForm.trainerId}
                      onChange={(e) => setTrainingForm({ ...trainingForm, trainerId: e.target.value })}
                      className="border rounded px-3 py-2 text-sm"
                    >
                      <option value="">None</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Topic *</label>
                    <input
                      type="text"
                      value={trainingForm.topic}
                      onChange={(e) => setTrainingForm({ ...trainingForm, topic: e.target.value })}
                      placeholder="e.g. HIPAA Compliance"
                      className="border rounded px-3 py-2 text-sm w-52"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Scheduled At *</label>
                    <input
                      type="datetime-local"
                      value={trainingForm.scheduledAt}
                      onChange={(e) => setTrainingForm({ ...trainingForm, scheduledAt: e.target.value })}
                      className="border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={addTrainingSession}
                    disabled={savingTraining}
                    className="bg-[#1D9E75] text-white text-sm rounded px-5 py-2 hover:bg-[#178a65] disabled:opacity-50"
                  >
                    {savingTraining ? 'Adding…' : 'Add Session'}
                  </button>
                </div>
              </div>

              {/* Sessions table */}
              <div className="rounded-lg border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Staff</th>
                      <th className="text-left px-4 py-3 font-semibold">Topic</th>
                      <th className="text-left px-4 py-3 font-semibold">Trainer</th>
                      <th className="text-left px-4 py-3 font-semibold">Scheduled</th>
                      <th className="text-left px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {training.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground italic text-sm">
                          No training sessions yet. Add one above.
                        </td>
                      </tr>
                    ) : (
                      training.map((t) => (
                        <tr key={t.id} className="border-t">
                          <td className="px-4 py-3">{t.user.firstName} {t.user.lastName}</td>
                          <td className="px-4 py-3">{t.topic}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {t.trainer ? `${t.trainer.firstName} ${t.trainer.lastName}` : '–'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.scheduledAt)}</td>
                          <td className="px-4 py-3">
                            {t.completedAt
                              ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Completed {fmtDate(t.completedAt)}</span>
                              : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Upcoming</span>}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            {!t.completedAt && (
                              <button onClick={() => markTrainingComplete(t.id)} className="text-xs text-[#1D9E75] hover:underline">
                                Mark Done
                              </button>
                            )}
                            <button onClick={() => deleteTraining(t.id)} className="text-xs text-red-500 hover:underline">
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
