import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetup, Location } from '../../../context/SetupContext'

const inputClass =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]'
const labelClass = 'block text-sm text-gray-600 mb-1 font-medium'

const emptyLocation = (): Location => ({
  id: crypto.randomUUID(),
  name: '',
  address: '',
  city: '',
  state: '',
  zip: '',
})

export default function Step8Locations() {
  const navigate = useNavigate()
  const { state, setLocations } = useSetup()
  const [draftLocations, setDraftLocations] = useState<Location[]>(
    state.locations.length > 0 ? state.locations : [emptyLocation()],
  )
  const [validationError, setValidationError] = useState(false)

  const updateLocation = (
    id: string,
    field: keyof Omit<Location, 'id'>,
    value: string,
  ) => {
    setDraftLocations((locs) =>
      locs.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    )
    setValidationError(false)
  }

  const addLocation = () => {
    setDraftLocations((locs) => [...locs, emptyLocation()])
  }

  const deleteLocation = (id: string) => {
    setDraftLocations((locs) => locs.filter((l) => l.id !== id))
  }

  const handleNext = () => {
    const valid = draftLocations.filter(
      (l) => l.name.trim() && l.address.trim(),
    )
    if (valid.length === 0) {
      setValidationError(true)
      return
    }
    setLocations(valid)
    navigate('/setup/launch')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-[#2C2C2A] mb-1">
        Add your office locations
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        At least one location is required.
      </p>

      <div className="space-y-4">
        {draftLocations.map((loc, idx) => (
          <div
            key={loc.id}
            className="bg-white border border-gray-200 rounded-lg p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-[#2C2C2A]">
                Location {idx + 1}
              </p>
              {draftLocations.length > 1 && (
                <button
                  onClick={() => deleteLocation(loc.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Location name */}
            <div className="mb-3">
              <label className={labelClass}>Location name</label>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. Main Office"
                value={loc.name}
                onChange={(e) => updateLocation(loc.id, 'name', e.target.value)}
              />
            </div>

            {/* Street address */}
            <div className="mb-3">
              <label className={labelClass}>Street address</label>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. 123 Main St"
                value={loc.address}
                onChange={(e) =>
                  updateLocation(loc.id, 'address', e.target.value)
                }
              />
            </div>

            {/* City / State / ZIP */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>City</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="New York"
                  value={loc.city}
                  onChange={(e) =>
                    updateLocation(loc.id, 'city', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="NY"
                  value={loc.state}
                  onChange={(e) =>
                    updateLocation(loc.id, 'state', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>ZIP</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="10001"
                  value={loc.zip}
                  onChange={(e) =>
                    updateLocation(loc.id, 'zip', e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {validationError && (
        <p className="text-sm text-red-500 mt-3">
          Please add at least one location with a name and address.
        </p>
      )}

      <button
        onClick={addLocation}
        className="flex items-center gap-2 text-sm font-medium text-[#1D9E75] hover:opacity-80 transition-opacity mt-4"
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
        Add another location
      </button>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => navigate('/setup/staff')}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1D9E75' }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
