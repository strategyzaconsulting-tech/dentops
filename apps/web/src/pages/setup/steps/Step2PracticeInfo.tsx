import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetup } from '../../../context/SetupContext'

const inputClass =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]'
const labelClass = 'block text-sm text-gray-600 mb-1 font-medium'

export default function Step2PracticeInfo() {
  const navigate = useNavigate()
  const { state, setPractice } = useSetup()
  const [form, setForm] = useState(state.practice)

  const update = (field: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleNext = () => {
    setPractice(form)
    navigate('/setup/logo')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-[#2C2C2A] mb-1">
        Tell us about your practice
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        This information will appear throughout the app.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
        {/* Practice name */}
        <div>
          <label className={labelClass}>Practice name</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Sunshine Dental"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>

        {/* Practice type */}
        <div>
          <label className={labelClass}>Practice type</label>
          <select
            className={inputClass}
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
          >
            <option>General Dentistry</option>
            <option>Orthodontics</option>
            <option>Pediatrics</option>
            <option>Oral Surgery</option>
            <option>Prosthodontics</option>
            <option>Endodontics</option>
            <option>Periodontics</option>
            <option>Multi-specialty</option>
            <option>DSO</option>
          </select>
        </div>

        {/* Owner full name */}
        <div>
          <label className={labelClass}>Owner full name</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Dr. Maria Santos"
            value={form.ownerName}
            onChange={(e) => update('ownerName', e.target.value)}
          />
        </div>

        {/* Email */}
        <div>
          <label className={labelClass}>Email address</label>
          <input
            type="email"
            className={inputClass}
            placeholder="e.g. maria@sunshinedentalco.com"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </div>

        {/* Phone */}
        <div>
          <label className={labelClass}>Phone number</label>
          <input
            type="tel"
            className={inputClass}
            placeholder="e.g. (555) 123-4567"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
        </div>

        {/* Tagline */}
        <div>
          <label className={labelClass}>
            Tagline{' '}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Caring for smiles since 2010"
            value={form.tagline}
            onChange={(e) => update('tagline', e.target.value)}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => navigate('/setup/welcome')}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1D9E75' }}
        >
          Next: Logo →
        </button>
      </div>
    </div>
  )
}
