export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const selectedPracticeId = localStorage.getItem('selected_practice_id')
  if (selectedPracticeId) headers.set('X-Practice-Id', selectedPracticeId)
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${API_BASE}${input}`, { ...init, headers })

  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    window.location.href = '/login'
    return res
  }

  return res
}
