import type { Doctor, StaffMember, Location, SetupState } from '../context/SetupContext'

export interface SetupPayload {
  practice: SetupState['practice']
  brandColor: string
  specialties: string[]
  doctors: Doctor[]
  staff: StaffMember[]
  locations: Location[]
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function submitSetup(data: SetupPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/api/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}
