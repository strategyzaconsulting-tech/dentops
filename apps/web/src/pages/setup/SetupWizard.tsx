import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const STEPS = [
  'welcome',
  'practice-info',
  'logo',
  'brand-color',
  'specialties',
  'doctors',
  'staff',
  'locations',
  'launch',
]

function getCurrentStep(pathname: string): number {
  const parts = pathname.split('/')
  const slug = parts[parts.length - 1]
  const idx = STEPS.indexOf(slug)
  return idx >= 0 ? idx + 1 : 1
}

export default function SetupWizard() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentStep = getCurrentStep(location.pathname)
  const progressPct = Math.round((currentStep / STEPS.length) * 100)

  return (
    <div className="min-h-screen bg-[#F1EFE8]">
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div
          className="h-full bg-[#1D9E75] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-1 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate('/setup/welcome')}
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-base"
              style={{ backgroundColor: '#1D9E75' }}
            >
              D
            </div>
            <span className="font-semibold text-[#2C2C2A] text-base">BRISA</span>
          </div>

          {/* Step indicator */}
          <div className="text-sm text-gray-500">
            Step{' '}
            <span className="font-semibold text-[#2C2C2A]">{currentStep}</span>{' '}
            of{' '}
            <span className="font-semibold text-[#2C2C2A]">{STEPS.length}</span>
          </div>
        </div>
      </header>

      {/* Step content */}
      <main className="pt-4 pb-12">
        <Outlet />
      </main>
    </div>
  )
}
