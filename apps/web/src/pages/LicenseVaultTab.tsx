import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'

// ─── Constants ────────────────────────────────────────────────────────────────

export const LICENSE_TYPES = [
  { key: 'malpractice',      label: 'Malpractice Insurance', hasState: false },
  { key: 'dental_license',   label: 'Dental License',        hasState: true  },
  { key: 'da_certification', label: 'DA Certification',      hasState: true  },
  { key: 'rdh_license',      label: 'RDH License',           hasState: true  },
  { key: 'dea',              label: 'DEA Number',            hasState: false },
  { key: 'caqh',             label: 'CAQH Number',           hasState: false },
  { key: 'npi',              label: 'NPI Number',            hasState: false },
  { key: 'cpr',              label: 'CPR / BLS Card',        hasState: false },
  { key: 'xray',             label: 'X-Ray Certificate',     hasState: true  },
  { key: 'other',            label: 'Other',                 hasState: true  },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const STATUS_CONFIG = {
  expired:       { label: 'Expired',       bg: 'bg-red-50',    border: 'border-red-200',   badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500'    },
  expiring_soon: { label: 'Expiring Soon', bg: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700',dot: 'bg-amber-400'  },
  active:        { label: 'Active',        bg: 'bg-white',     border: 'border-gray-100',  badge: 'bg-green-50 text-green-700', dot: 'bg-[#1D9E75]'  },
  no_expiry:     { label: 'No Expiry',     bg: 'bg-white',     border: 'border-gray-100',  badge: 'bg-gray-100 text-gray-500',  dot: 'bg-gray-300'   },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface License {
  id: string
  type: string
  label: string | null
  licenseNumber: string | null
  state: string | null
  issuedDate: string | null
  expirationDate: string | null
  notes: string | null
  alertDays: number
  insuranceCarrier: string | null
  coverageAmount: string | null
}

interface FormState {
  type: string
  label: string
  licenseNumber: string
  state: string
  issuedDate: string
  expirationDate: string
  notes: string
  alertDays: string
  insuranceCarrier: string
  coverageAmount: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function licenseStatus(exp: string | null, alertDays: number): keyof typeof STATUS_CONFIG {
  if (!exp) return 'no_expiry'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expDate = new Date(toDateOnly(exp) + 'T12:00:00')
  const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / 86400000)
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= alertDays) return 'expiring_soon'
  return 'active'
}

function toDateOnly(iso: string): string {
  return iso.split('T')[0]
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(toDateOnly(iso) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp = new Date(toDateOnly(iso) + 'T12:00:00')
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000)
}

function typeLabel(lic: License) {
  return lic.label ?? LICENSE_TYPES.find(t => t.key === lic.type)?.label ?? lic.type
}

const emptyForm: FormState = {
  type: 'dental_license',
  label: '',
  licenseNumber: '',
  state: '',
  issuedDate: '',
  expirationDate: '',
  notes: '',
  alertDays: '30',
  insuranceCarrier: '',
  coverageAmount: '',
}

interface LicenseDoc {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  createdAt: string
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  role?: string
  onUpdated?: () => void
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function LicenseVaultTab({ userId, role, onUpdated }: Props) {
  const isDoctor = role === 'doctor'
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; license?: License } | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Documents per license
  const [docs, setDocs] = useState<Record<string, LicenseDoc[]>>({})
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await apiFetch(`/api/licenses?userId=${userId}`)
    const data = await res.json()
    if (Array.isArray(data)) setLicenses(data)
    setLoading(false)
  }

  async function loadDocs(licenseId: string) {
    const res = await apiFetch(`/api/license-documents?licenseId=${licenseId}`)
    const data = await res.json()
    if (Array.isArray(data)) setDocs(prev => ({ ...prev, [licenseId]: data }))
  }

  function toggleDocs(licenseId: string) {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      if (next.has(licenseId)) {
        next.delete(licenseId)
      } else {
        next.add(licenseId)
        if (!docs[licenseId]) loadDocs(licenseId)
      }
      return next
    })
  }

  async function handleUpload(licenseId: string, file: File) {
    if (file.size > 10 * 1024 * 1024) {
      alert('File exceeds 10 MB limit.')
      return
    }
    setUploadingFor(licenseId)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      await apiFetch('/api/license-documents', {
        method: 'POST',
        body: JSON.stringify({
          licenseId, userId,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileDataBase64: base64,
        }),
      })
      await loadDocs(licenseId)
      setUploadingFor(null)
    }
    reader.readAsDataURL(file)
  }

  async function handleDownload(docId: string, fileName: string) {
    const res = await apiFetch(`/api/license-documents/${docId}/download`)
    const { fileDataBase64, mimeType } = await res.json()
    const bytes = Uint8Array.from(atob(fileDataBase64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = fileName; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDeleteDoc(licenseId: string, docId: string) {
    setDeletingDocId(docId)
    await apiFetch(`/api/license-documents/${docId}`, { method: 'DELETE' })
    setDocs(prev => ({ ...prev, [licenseId]: (prev[licenseId] ?? []).filter(d => d.id !== docId) }))
    setDeletingDocId(null)
  }

  useEffect(() => { load() }, [userId])

  function openAdd(defaultType?: string) {
    setForm({ ...emptyForm, type: defaultType ?? 'dental_license' })
    setModal({ mode: 'add' })
  }

  function openEdit(lic: License) {
    setForm({
      type: lic.type,
      label: lic.label ?? '',
      licenseNumber: lic.licenseNumber ?? '',
      state: lic.state ?? '',
      issuedDate: lic.issuedDate ? lic.issuedDate.split('T')[0] : '',
      expirationDate: lic.expirationDate ? lic.expirationDate.split('T')[0] : '',
      notes: lic.notes ?? '',
      alertDays: String(lic.alertDays),
      insuranceCarrier: lic.insuranceCarrier ?? '',
      coverageAmount: lic.coverageAmount ?? '',
    })
    setModal({ mode: 'edit', license: lic })
  }

  async function handleSave() {
    setSaving(true)
    const body = {
      userId,
      type: form.type,
      label: form.type === 'other' ? (form.label || null) : null,
      licenseNumber: form.licenseNumber || null,
      state: form.state || null,
      issuedDate: form.issuedDate || null,
      expirationDate: form.expirationDate || null,
      notes: form.notes || null,
      alertDays: parseInt(form.alertDays) || 30,
      insuranceCarrier: form.type === 'malpractice' ? (form.insuranceCarrier || null) : null,
      coverageAmount: form.type === 'malpractice' ? (form.coverageAmount || null) : null,
    }
    if (modal?.mode === 'add') {
      await apiFetch('/api/licenses', { method: 'POST', body: JSON.stringify(body) })
    } else if (modal?.mode === 'edit' && modal.license) {
      await apiFetch(`/api/licenses/${modal.license.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    }
    setSaving(false)
    setModal(null)
    await load()
    onUpdated?.()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await apiFetch(`/api/licenses/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    setConfirmDeleteId(null)
    await load()
    onUpdated?.()
  }

  const selectedType = LICENSE_TYPES.find(t => t.key === form.type)

  // Group by status priority: expired → expiring_soon → active → no_expiry
  const sorted = [...licenses].sort((a, b) => {
    const order = { expired: 0, expiring_soon: 1, active: 2, no_expiry: 3 }
    return (order[licenseStatus(a.expirationDate, a.alertDays)] ?? 4) - (order[licenseStatus(b.expirationDate, b.alertDays)] ?? 4)
  })

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const hasMalpractice = licenses.some(
    l => l.type === 'malpractice' && (!l.expirationDate || new Date(toDateOnly(l.expirationDate) + 'T12:00:00') >= today)
  )

  return (
    <div className="px-6 py-5">
      {/* Required: malpractice for doctors */}
      {isDoctor && !loading && !hasMalpractice && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <span className="shrink-0 text-orange-500 mt-0.5">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-orange-800">Malpractice insurance required</p>
            <p className="text-[11px] text-orange-600 mt-0.5">No active malpractice insurance on file for this doctor.</p>
          </div>
          <button
            onClick={() => openAdd('malpractice')}
            className="shrink-0 rounded-lg bg-orange-500 hover:bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            Add Now
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">License Vault</h3>
        <button
          onClick={() => openAdd()}
          className="rounded-lg bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          + Add License
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
          <p className="text-sm text-gray-400">No licenses on file.</p>
          <button onClick={() => openAdd()} className="mt-2 text-xs font-semibold text-[#1D9E75] hover:underline">
            Add first license →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(lic => {
            const status = licenseStatus(lic.expirationDate, lic.alertDays)
            const cfg = STATUS_CONFIG[status]
            const days = daysUntil(lic.expirationDate)
            const isConfirmDelete = confirmDeleteId === lic.id
            const isDeleting = deletingId === lic.id

            return (
              <div key={lic.id} className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
                <div className="flex items-start justify-between px-4 py-3 gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`mt-1 shrink-0 h-2 w-2 rounded-full ${cfg.dot}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{typeLabel(lic)}</p>
                        {lic.state && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 uppercase">
                            {lic.state}
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>
                          {status === 'expiring_soon' && days !== null
                            ? days === 0 ? 'Expires today' : `${days}d left`
                            : status === 'expired' && days !== null
                            ? `${Math.abs(days)}d ago`
                            : cfg.label}
                        </span>
                      </div>
                      {lic.type === 'malpractice' && (
                        <div className="mt-1 space-y-0.5">
                          {lic.insuranceCarrier && (
                            <p className="text-xs text-gray-600 font-medium">{lic.insuranceCarrier}</p>
                          )}
                          {lic.coverageAmount && (
                            <p className="text-xs text-gray-500">Coverage: <span className="font-semibold text-gray-700">{lic.coverageAmount}</span></p>
                          )}
                        </div>
                      )}
                      {lic.licenseNumber && (
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">{lic.licenseNumber}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {lic.issuedDate && (
                          <span className="text-[11px] text-gray-400">Issued {fmtDate(lic.issuedDate)}</span>
                        )}
                        {lic.expirationDate && (
                          <span className={`text-[11px] font-medium ${status === 'expired' ? 'text-red-500' : status === 'expiring_soon' ? 'text-amber-600' : 'text-gray-400'}`}>
                            Exp {fmtDate(lic.expirationDate)}
                          </span>
                        )}
                      </div>
                      {lic.notes && (
                        <p className="text-[11px] text-gray-400 mt-1 italic">"{lic.notes}"</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {isConfirmDelete ? (
                      <>
                        <button
                          onClick={() => handleDelete(lic.id)}
                          disabled={isDeleting}
                          className="text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded px-2 py-0.5 disabled:opacity-50"
                        >
                          {isDeleting ? '…' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[11px] text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(lic)}
                          className="text-[11px] font-medium text-[#1D9E75] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(lic.id)}
                          className="text-[11px] font-medium text-gray-300 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Documents section */}
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => toggleDocs(lic.id)}
                    className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <span>📎</span> Documents
                      {docs[lic.id]?.length ? (
                        <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">{docs[lic.id].length}</span>
                      ) : null}
                    </span>
                    <span className="text-gray-400 text-xs">{expandedDocs.has(lic.id) ? '▲' : '▼'}</span>
                  </button>

                  {expandedDocs.has(lic.id) && (
                    <div className="px-4 pb-3 space-y-2">
                      {/* File list */}
                      {(docs[lic.id] ?? []).length === 0 ? (
                        <p className="text-xs text-gray-400 py-1">No documents attached.</p>
                      ) : (
                        <div className="space-y-1">
                          {(docs[lic.id] ?? []).map(doc => (
                            <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-gray-300 shrink-0">
                                  {doc.mimeType.includes('pdf') ? '📄' : doc.mimeType.includes('image') ? '🖼' : '📎'}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-gray-700 truncate">{doc.fileName}</p>
                                  <p className="text-[10px] text-gray-400">{fmtBytes(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <button
                                  onClick={() => handleDownload(doc.id, doc.fileName)}
                                  className="text-[11px] font-medium text-[#1D9E75] hover:underline"
                                >
                                  Download
                                </button>
                                <button
                                  onClick={() => handleDeleteDoc(lic.id, doc.id)}
                                  disabled={deletingDocId === doc.id}
                                  className="text-gray-300 hover:text-red-500 text-xs disabled:opacity-50"
                                >
                                  {deletingDocId === doc.id ? '…' : '✕'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload */}
                      <label className={`flex items-center gap-2 rounded-lg border border-dashed border-[#1D9E75] px-3 py-2 cursor-pointer hover:bg-[#F0FDF9] transition-colors ${uploadingFor === lic.id ? 'opacity-50 pointer-events-none' : ''}`}>
                        <span className="text-[#1D9E75] text-sm">{uploadingFor === lic.id ? '⏳' : '+'}</span>
                        <span className="text-xs font-semibold text-[#1D9E75]">
                          {uploadingFor === lic.id ? 'Uploading…' : 'Attach document'}
                        </span>
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleUpload(lic.id, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                      <p className="text-[10px] text-gray-400">PDF, images, or Word docs · Max 10 MB</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">
                {modal.mode === 'add' ? 'Add License' : 'Edit License'}
              </h3>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">License type</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value, label: '' }))}
                >
                  {LICENSE_TYPES.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Custom label for "Other" */}
              {form.type === 'other' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Custom name</label>
                  <input
                    type="text"
                    placeholder="e.g. Laser Certification"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.label}
                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  />
                </div>
              )}

              {/* Malpractice-specific fields */}
              {form.type === 'malpractice' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Insurance carrier <span className="font-normal text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. The Doctors Company, ProAssurance"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      value={form.insuranceCarrier}
                      onChange={e => setForm(f => ({ ...f, insuranceCarrier: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Coverage amount <span className="font-normal text-gray-400">(e.g. $1M / $3M)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="$1,000,000 / $3,000,000"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      value={form.coverageAmount}
                      onChange={e => setForm(f => ({ ...f, coverageAmount: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* License / ID / Policy number */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {form.type === 'caqh'        ? 'CAQH Number'
                    : form.type === 'dea'      ? 'DEA Number'
                    : form.type === 'npi'      ? 'NPI Number'
                    : form.type === 'malpractice' ? 'Policy number'
                    : 'License / Certificate number'}
                  <span className="ml-1 font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.licenseNumber}
                  onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))}
                />
              </div>

              {/* State — only for state-specific types */}
              {selectedType?.hasState && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    State <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  >
                    <option value="">— Not state-specific —</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Issue date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.issuedDate}
                    onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expiration date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    value={form.expirationDate}
                    onChange={e => setForm(f => ({ ...f, expirationDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Alert threshold */}
              {form.expirationDate && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Alert me this many days before expiration
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min="7" max="90" step="1"
                      className="flex-1 accent-[#1D9E75]"
                      value={form.alertDays}
                      onChange={e => setForm(f => ({ ...f, alertDays: e.target.value }))}
                    />
                    <span className="w-10 text-center text-sm font-semibold text-gray-700">{form.alertDays}d</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Notes <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Renewal pending, contact Dr. Smith"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
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
                disabled={saving || !form.type}
                className="flex-1 rounded-lg bg-[#1D9E75] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Add License' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
