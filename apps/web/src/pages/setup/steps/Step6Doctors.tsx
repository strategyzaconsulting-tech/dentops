import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetup, Doctor } from '../../../context/SetupContext'

const ALL_SPECIALTIES = [
  'General Dentistry',
  'Orthodontics',
  'Periodontics',
  'Endodontics',
  'Oral Surgery',
  'Prosthodontics',
  'Pediatric Dentistry',
  'Cosmetic Dentistry',
  'Oral Medicine',
  'Implantology',
  'Dental Public Health',
  'Oral Pathology',
]

const inputClass =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]'
const labelClass = 'block text-sm text-gray-600 mb-1 font-medium'

const emptyForm = { firstName: '', lastName: '', email: '', specialty: '' }

export default function Step6Doctors() {
  const navigate = useNavigate()
  const { state, setDoctors } = useSetup()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const specialtyOptions =
    state.specialties.length > 0 ? state.specialties : ALL_SPECIALTIES

  const update = (field: keyof typeof emptyForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleAdd = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) return
    const doctor: Doctor = {
      id: crypto.randomUUID(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      specialty: form.specialty || specialtyOptions[0] || '',
    }
    setDoctors([...state.doctors, doctor])
    setForm(emptyForm)
    setShowForm(false)
  }

  const handleDelete = (id: string) => {
    setDoctors(state.doctors.filter((d) => d.id !== id))
  }

  const getInitials = (d: Doctor) =>
    (d.firstName[0] ?? '') + (d.lastName[0] ?? '')

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-[#2C2C2A] mb-1">
        Add your doctors
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        They'll receive an email invite to join Brisa.
      </p>

      {/* Doctor list */}
      {state.doctors.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 mb-4">
          {state.doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                style={{ backgroundColor: '#1D9E75' }}
              >
                {getInitials(doctor)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#2C2C2A]">
                  Dr. {doctor.firstName} {doctor.lastName}
                </p>
                <p className="text-xs text-gray-400">
                  {doctor.specialty} · {doctor.email}
                </p>
              </div>
              <button
                onClick={() => handleDelete(doctor.id)}
                className="text-gray-300 hover:text-red-400 transition-colors ml-2 flex-shrink-0"
                title="Remove"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline add form */}
      {showForm ? (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <p className="text-sm font-semibold text-[#2C2C2A] mb-4">New doctor</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>First name</label>
              <input
                type="text"
                className={inputClass}
                value={form.firstName}
                onChange={(e) => update('firstName', e.target.value)}
                placeholder="Maria"
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Last name</label>
              <input
                type="text"
                className={inputClass}
                value={form.lastName}
                onChange={(e) => update('lastName', e.target.value)}
                placeholder="Santos"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className={labelClass}>Specialty</label>
              <select
                className={inputClass}
                value={form.specialty}
                onChange={(e) => update('specialty', e.target.value)}
              >
                {specialtyOptions.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="maria@practice.com"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              className="px-4 py-2 rounded-md text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#1D9E75' }}
            >
              Add
            </button>
            <button
              onClick={() => {
                setForm(emptyForm)
                setShowForm(false)
              }}
              className="px-4 py-2 rounded-md text-sm text-gray-500 border border-gray-200 hover:bg-[#F0EDE5] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm font-medium text-[#1D9E75] hover:opacity-80 transition-opacity mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add doctor
        </button>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => navigate('/setup/specialties')}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-4">
          {state.doctors.length === 0 && (
            <button
              onClick={() => navigate('/setup/staff')}
              className="text-sm text-[#1D9E75] hover:underline"
            >
              Skip for now →
            </button>
          )}
          <button
            onClick={() => navigate('/setup/staff')}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#1D9E75' }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
