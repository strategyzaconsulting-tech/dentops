import { useNavigate } from 'react-router-dom'

export default function Step1Welcome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Large logo mark */}
        <div className="flex justify-center mb-6">
          <svg width="96" height="96" viewBox="0 0 44 44" fill="none" className="shadow-md rounded-2xl">
            <rect width="44" height="44" rx="10" fill="#1E2E2A" />
            <path d="M8 16 Q15 11 22 16 Q29 21 36 16" stroke="#A8D5E2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M8 22 Q16 16 24 22 Q30 26 36 22" stroke="#5BA4BE" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M8 28 Q14 23 20 28 Q28 34 36 28" stroke="#8BAF9A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        <h1 className="text-3xl font-semibold text-[#2C2C2A] mb-3">
          Welcome to BRISA
        </h1>
        <p className="text-sm text-gray-500 mb-10">
          Let's get your practice set up. This takes about 5 minutes.
        </p>

        <button
          onClick={() => navigate('/setup/practice-info')}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1D9E75' }}
        >
          Get started →
        </button>
      </div>
    </div>
  )
}
