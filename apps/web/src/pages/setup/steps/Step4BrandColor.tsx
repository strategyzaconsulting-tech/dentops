import { useNavigate } from 'react-router-dom'
import { useSetup } from '../../../context/SetupContext'

const COLOR_OPTIONS = [
  { name: 'Teal', value: '#1D9E75' },
  { name: 'Coral', value: '#D85A30' },
  { name: 'Amber', value: '#BA7517' },
  { name: 'Blue', value: '#185FA5' },
  { name: 'Purple', value: '#534AB7' },
  { name: 'Slate', value: '#475569' },
  { name: 'Green', value: '#3B6D11' },
  { name: 'Pink', value: '#993556' },
]

const NAV_ITEMS = ['Dashboard', 'Schedule', 'Staff', 'Locations', 'Settings']

export default function Step4BrandColor() {
  const navigate = useNavigate()
  const { state, setBrandColor } = useSetup()
  const selected = state.brandColor

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-[#2C2C2A] mb-1">
        Choose your brand color
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        This color will be used throughout the app for your practice.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex gap-8 items-start">
          {/* Swatches */}
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
              Select a color
            </p>
            <div className="grid grid-cols-4 gap-4">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setBrandColor(color.value)}
                  className="flex flex-col items-center gap-1.5 group"
                  title={color.name}
                >
                  <div
                    className="w-13 h-13 rounded-full flex items-center justify-center border-2 transition-all"
                    style={{
                      backgroundColor: color.value,
                      width: 52,
                      height: 52,
                      borderColor:
                        selected === color.value ? '#2C2C2A' : 'transparent',
                      boxShadow:
                        selected === color.value
                          ? '0 0 0 2px #fff, 0 0 0 4px ' + color.value
                          : 'none',
                    }}
                  >
                    {selected === color.value && (
                      <svg
                        className="w-5 h-5 text-white"
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
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Live preview sidebar */}
          <div className="flex-shrink-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
              Preview
            </p>
            <div
              className="rounded-lg overflow-hidden border border-gray-200"
              style={{ width: 110, height: 210 }}
            >
              {/* Sidebar */}
              <div className="bg-[#2C2C2A] h-full flex flex-col">
                {/* Logo area */}
                <div className="px-2.5 pt-3 pb-2 flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ backgroundColor: selected }}
                  >
                    D
                  </div>
                  <span className="text-white text-xs font-semibold truncate">
                    DentOps
                  </span>
                </div>

                <div className="h-px bg-white/10 mx-2 mb-1" />

                {/* Nav items */}
                <div className="flex-1 px-1.5 py-1 space-y-0.5">
                  {NAV_ITEMS.map((item, i) => (
                    <div
                      key={item}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs"
                      style={
                        i === 0
                          ? {
                              backgroundColor: selected,
                              color: '#fff',
                              fontWeight: 600,
                            }
                          : { color: 'rgba(255,255,255,0.55)' }
                      }
                    >
                      <div
                        className="w-2 h-2 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor:
                            i === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)',
                        }}
                      />
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => navigate('/setup/logo')}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => navigate('/setup/specialties')}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1D9E75' }}
        >
          Next: Specialties →
        </button>
      </div>
    </div>
  )
}
