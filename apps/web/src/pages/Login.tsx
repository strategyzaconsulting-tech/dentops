import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const loggedInUser = await login(email, password)
      if (loggedInUser.role === 'doctor' || loggedInUser.role === 'staff') {
        localStorage.removeItem('auth_token')
        setError('Please use the BRISA mobile app to sign in.')
        return
      }
      navigate(loggedInUser.role === 'super_admin' ? '/admin' : '/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <svg width="48" height="48" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="10" fill="#1E2E2A" />
              <path d="M8 16 Q15 11 22 16 Q29 21 36 16" stroke="#A8D5E2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M8 22 Q16 16 24 22 Q30 26 36 22" stroke="#5BA4BE" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M8 28 Q14 23 20 28 Q28 34 36 28" stroke="#8BAF9A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <h1 className="text-2xl font-light tracking-[0.35em] text-[#2C3E3A] uppercase">BRISA</h1>
          <p className="text-sm text-[#4A5C52] mt-1">Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#1D9E75] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>


          <p className="text-center text-xs text-gray-400 pt-1">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#1D9E75] font-medium hover:underline">
              Start your free trial
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
