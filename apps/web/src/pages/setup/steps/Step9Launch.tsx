import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetup } from '../../../context/SetupContext'
import { submitSetup } from '../../../services/api'

export default function Step9Launch() {
  const navigate = useNavigate()
  const { state } = useSetup()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLaunch = async () => {
    setLoading(true)
    setError(null)
    if (state.logoFile) {
      console.log('Logo upload:', state.logoFile.name)
    }
    try {
      await submitSetup({
        practice: state.practice,
        brandColor: state.brandColor,
        specialties: state.specialties,
        doctors: state.doctors,
        staff: state.staff,
        locations: state.locations,
      })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: '#E1F5EE' }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: '#1D9E75' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-semibold text-[#2C2C2A]">You're all set!</h1>
        <p className="text-sm text-gray-500 mt-2">
          Here's a summary of your practice setup.
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 mb-8">
        {/* Practice */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Practice
          </p>
          <p className="text-sm font-semibold text-[#2C2C2A]">
            {state.practice.name || '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {state.practice.type}
            {state.practice.tagline ? ` · "${state.practice.tagline}"` : ''}
          </p>
        </div>

        {/* Logo + Brand color */}
        <div className="px-5 py-4 flex gap-8">
          {/* Logo */}
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Logo
            </p>
            {state.logoPreviewUrl ? (
              <img
                src={state.logoPreviewUrl}
                alt="Logo"
                className="max-h-10 max-w-[100px] object-contain"
              />
            ) : (
              <p className="text-xs text-gray-400 italic">No logo uploaded</p>
            )}
          </div>

          {/* Brand color */}
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Brand color
            </p>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full border border-gray-200"
                style={{ backgroundColor: state.brandColor }}
              />
              <span className="text-xs text-gray-600 font-mono">
                {state.brandColor}
              </span>
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Specialties
          </p>
          <p className="text-sm text-[#2C2C2A]">
            {state.specialties.length > 0
              ? state.specialties.join(', ')
              : '—'}
          </p>
        </div>

        {/* Doctors */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Doctors ({state.doctors.length})
          </p>
          {state.doctors.length > 0 ? (
            <p className="text-sm text-[#2C2C2A]">
              {state.doctors
                .map((d) => `Dr. ${d.firstName} ${d.lastName}`)
                .join(', ')}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">None added</p>
          )}
        </div>

        {/* Staff */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Staff ({state.staff.length})
          </p>
          {state.staff.length > 0 ? (
            <p className="text-sm text-[#2C2C2A]">
              {state.staff
                .map((m) => `${m.firstName} ${m.lastName}`)
                .join(', ')}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">None added</p>
          )}
        </div>

        {/* Locations */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Locations ({state.locations.length})
          </p>
          {state.locations.length > 0 ? (
            <p className="text-sm text-[#2C2C2A]">
              {state.locations.map((l) => l.name).join(', ')}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">None added</p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Launch button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={handleLaunch}
          disabled={loading}
          className="w-full max-w-xs px-8 py-3 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ backgroundColor: '#1D9E75' }}
        >
          {loading ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Setting up your practice...
            </>
          ) : (
            'Launch Brisa →'
          )}
        </button>

        <button
          onClick={() => navigate('/setup/locations')}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Go back and edit
        </button>
      </div>
    </div>
  )
}
