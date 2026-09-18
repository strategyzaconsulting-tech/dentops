import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

interface Practice {
  id: string
  name: string
  type: string | null
  brandColor: string | null
  createdAt: string
  userCount: number
  locationCount: number
}

export default function AdminDashboard() {
  const { user, logout, selectPractice } = useAuth()
  const navigate = useNavigate()
  const [practices, setPractices] = useState<Practice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    fetch(`${API_BASE}/api/admin/practices`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setPractices)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="10" fill="#1E2E2A" />
            <path d="M8 16 Q15 11 22 16 Q29 21 36 16" stroke="#A8D5E2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M8 22 Q16 16 24 22 Q30 26 36 22" stroke="#5BA4BE" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M8 28 Q14 23 20 28 Q28 34 36 28" stroke="#8BAF9A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
          <span className="text-sm font-semibold text-[#2C2C2A]">BRISA</span>
          <span className="text-xs text-gray-400 ml-1">Platform Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">{user?.email}</span>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#2C2C2A]">All Practices</h1>
          <p className="text-sm text-gray-500 mt-1">{practices.length} tenant{practices.length !== 1 ? 's' : ''} on the platform</p>
        </div>

        {loading && (
          <div className="text-sm text-gray-400">Loading practices…</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && practices.length === 0 && (
          <div className="text-sm text-gray-400">No practices yet.</div>
        )}

        {!loading && practices.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Practice</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Users</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Locations</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Created</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {practices.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F9F7F3] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex-shrink-0"
                          style={{ backgroundColor: p.brandColor ?? '#1D9E75' }}
                        />
                        <span className="font-medium text-[#2C2C2A]">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500">{p.type ? p.type.charAt(0).toUpperCase() + p.type.slice(1).toLowerCase() : '—'}</td>
                    <td className="px-5 py-4 text-center text-gray-700">{p.userCount}</td>
                    <td className="px-5 py-4 text-center text-gray-700">{p.locationCount}</td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => { selectPractice(p.id, p.name); navigate('/') }}
                        className="text-xs font-medium text-[#1D9E75] hover:underline"
                      >
                        Enter →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
