import { useNavigate } from 'react-router-dom'
import { useSetup } from '../../../context/SetupContext'

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

export default function Step5Specialties() {
  const navigate = useNavigate()
  const { state, setSpecialties } = useSetup()
  const selected = state.specialties

  const toggle = (specialty: string) => {
    if (selected.includes(specialty)) {
      setSpecialties(selected.filter((s) => s !== specialty))
    } else {
      setSpecialties([...selected, specialty])
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-[#2C2C2A] mb-1">
        What specialties does your practice offer?
      </h1>
      <p className="text-sm text-gray-500 mb-8">Select all that apply.</p>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-3 gap-3">
          {ALL_SPECIALTIES.map((specialty) => {
            const isSelected = selected.includes(specialty)
            return (
              <button
                key={specialty}
                onClick={() => toggle(specialty)}
                className="px-3 py-2.5 rounded-full border text-sm font-medium transition-all text-center"
                style={
                  isSelected
                    ? {
                        backgroundColor: '#E1F5EE',
                        borderColor: '#1D9E75',
                        color: '#085041',
                      }
                    : {
                        backgroundColor: '#fff',
                        borderColor: '#e5e7eb',
                        color: '#4b5563',
                      }
                }
              >
                {specialty}
              </button>
            )
          })}
        </div>

        {selected.length > 0 && (
          <p className="text-xs text-gray-400 mt-4">
            {selected.length} selected
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => navigate('/setup/brand-color')}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => navigate('/setup/doctors')}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1D9E75' }}
        >
          Next: Doctors →
        </button>
      </div>
    </div>
  )
}
