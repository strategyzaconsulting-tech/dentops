import { useNavigate } from 'react-router-dom'

export default function Step1Welcome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Large logo mark */}
        <div className="flex justify-center mb-6">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-md"
            style={{ backgroundColor: '#1D9E75' }}
          >
            D
          </div>
        </div>

        <h1 className="text-3xl font-semibold text-[#2C2C2A] mb-3">
          Welcome to Brisa
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
