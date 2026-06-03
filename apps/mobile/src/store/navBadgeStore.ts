type Module = 'timeClock' | 'openShifts' | 'timeOff'

const seen = new Set<Module>()

export function markModuleSeen(module: Module) {
  seen.add(module)
}

export function timeClockHasBadge(adjustments: { status: string }[]): boolean {
  if (seen.has('timeClock')) return false
  return adjustments.some((a) => a.status === 'approved' || a.status === 'denied')
}

export function openShiftsHasBadge(shifts: unknown[]): boolean {
  if (seen.has('openShifts')) return false
  return shifts.length > 0
}

export function timeOffHasBadge(requests: { status: string }[]): boolean {
  if (seen.has('timeOff')) return false
  return requests.some((r) => r.status === 'approved' || r.status === 'denied')
}
