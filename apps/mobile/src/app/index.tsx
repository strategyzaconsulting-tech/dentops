import { useEffect, useState } from 'react'
import BottomNav from '../components/BottomNav'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../lib/AuthContext'
import { apiFetch } from '../lib/api'

const SPECIALTIES = [
  'General Dentistry', 'Orthodontics', 'Periodontics',
  'Endodontics', 'Oral Surgery', 'Hygiene', 'Front Desk',
]

const TEST_LOCATIONS = [
  { id: 'test-loc-1', name: 'Main Office', address: '123 Dental Ave', city: 'New York', state: 'NY' },
  { id: 'test-loc-2', name: 'Uptown Branch', address: '456 Park Ave', city: 'New York', state: 'NY' },
]


const LOG_LABELS: Record<string, string> = {
  clockIn: 'Clocked in',
  breakStart: 'Meal break started',
  breakEnd: 'Meal break ended',
}

const LOG_COLORS: Record<string, string> = {
  clockIn: '#1D9E75',
  breakStart: '#D97706',
  breakEnd: '#3B82F6',
}

const ADJ_TYPES = ['missed_clock_in', 'missed_clock_out', 'begin_meal', 'end_meal', 'wrong_time', 'other'] as const
type AdjType = (typeof ADJ_TYPES)[number]

const CORR_TYPES = ['clock_in', 'clock_out', 'begin_meal', 'end_meal'] as const
type CorrType = (typeof CORR_TYPES)[number]
const CORR_LABELS: Record<CorrType, string> = { clock_in: 'Clock In', clock_out: 'Clock Out', begin_meal: 'Begin Meal', end_meal: 'End Meal' }
const CORR_TO_ADJ: Record<CorrType, AdjType> = { clock_in: 'missed_clock_in', clock_out: 'missed_clock_out', begin_meal: 'begin_meal', end_meal: 'end_meal' }

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Location { id: string; name: string; address?: string; city?: string; state?: string }
interface TimePunch { id: string; punchIn: string; locationId: string; specialty?: string; isTardy?: boolean }
interface LogEntry { event: 'clockIn' | 'breakStart' | 'breakEnd'; time: Date }
interface CorrEntry { id: string; dateStr: string; type: CorrType; time: string }

interface WeekPunch {
  id: string
  punchIn: string
  punchOut: string | null
  location: { name: string }
  specialty: string | null
  breakStart: string | null
  breakEnd: string | null
  isTardy: boolean
}

interface Pt { x: number; y: number }

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(): Date[] {
  const monday = getMonday(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })
}

function todayDateStr(): string {
  const d = new Date()
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

function parseDateStr(str: string): Date | null {
  const parts = str.trim().split('/')
  if (parts.length < 3) return null
  const month = parseInt(parts[0], 10) - 1
  const day = parseInt(parts[1], 10)
  const y = parseInt(parts[2], 10)
  if (isNaN(month) || isNaN(day) || isNaN(y)) return null
  const year = y < 100 ? 2000 + y : y
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  const d = new Date(year, month, day)
  if (d.getMonth() !== month || d.getDate() !== day) return null
  if (d > new Date()) return null
  return d
}

function parseTimeStr(str: string, base: Date): Date | null {
  const s = str.trim().toUpperCase()
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 1 || h > 12 || min < 0 || min > 59) return null
  if (m[3] === 'PM' && h !== 12) h += 12
  if (m[3] === 'AM' && h === 12) h = 0
  const d = new Date(base)
  d.setHours(h, min, 0, 0)
  return d
}

function punchDurationMs(p: WeekPunch): number {
  const start = new Date(p.punchIn).getTime()
  const end = p.punchOut ? new Date(p.punchOut).getTime() : 0
  if (!p.punchOut) return 0
  let ms = end - start
  if (p.breakStart && p.breakEnd) {
    ms -= new Date(p.breakEnd).getTime() - new Date(p.breakStart).getTime()
  }
  return Math.max(0, ms)
}

function formatHours(ms: number): string {
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  const rem = m % 60
  return h > 0 ? `${h}h ${rem}m` : `${rem}m`
}


function formatTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m}:${s} ${ampm}`
}

function formatLogTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m} ${ampm}`
}

function formatHm(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function bezierWavePoints(p0: Pt, p1: Pt, p2: Pt, p3: Pt, p4: Pt, n = 8): Pt[] {
  const pts: Pt[] = []
  const qb = (t: number, a: Pt, b: Pt, c: Pt): Pt => ({
    x: (1-t)*(1-t)*a.x + 2*(1-t)*t*b.x + t*t*c.x,
    y: (1-t)*(1-t)*a.y + 2*(1-t)*t*b.y + t*t*c.y,
  })
  for (let i = 0; i <= n; i++) pts.push(qb(i / n, p0, p1, p2))
  for (let i = 1; i <= n; i++) pts.push(qb(i / n, p2, p3, p4))
  return pts
}

function WaveLine({ color, p0, p1, p2, p3, p4 }: { color: string; p0: Pt; p1: Pt; p2: Pt; p3: Pt; p4: Pt }) {
  const pts = bezierWavePoints(p0, p1, p2, p3, p4)
  const cy = p0.y
  const sx = 44 / 38
  const sy = 0.72
  const scaled = pts.map(p => ({ x: (p.x - 8) * sx, y: 7 + (p.y - cy) * sy }))
  return (
    <View style={{ position: 'relative', width: 44, height: 14 }}>
      {scaled.slice(0, -1).map((p, i) => {
        const q = scaled[i + 1]
        const dx = q.x - p.x
        const dy = q.y - p.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)
        return (
          <View key={i} style={{ position: 'absolute', left: (p.x + q.x) / 2 - len / 2, top: (p.y + q.y) / 2 - 1.25, width: len, height: 2.5, borderRadius: 1.5, backgroundColor: color, transform: [{ rotate: `${angle}deg` }] }} />
        )
      })}
    </View>
  )
}

export default function HomeScreen() {
  const { user } = useAuth()
  const practiceId = user?.practiceId ?? ''
  const userId = user?.id ?? ''

  const [now, setNow] = useState(new Date())
  const [practiceName, setPracticeName] = useState<string | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [showClockInModal, setShowClockInModal] = useState(false)
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [showSpecialtyDropdown, setShowSpecialtyDropdown] = useState(false)
  const [clockingIn, setClockingIn] = useState(false)
  const [punch, setPunch] = useState<TimePunch | null>(null)
  const [onBreak, setOnBreak] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)
  const [breakLoading, setBreakLoading] = useState(false)
  const [breakLog, setBreakLog] = useState<LogEntry[]>([])

  // Specialty
  const [requireSpecialty, setRequireSpecialty] = useState(false)
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null)

  // Weekly timesheet
  const [showTimesheet, setShowTimesheet] = useState(false)
  const [weekPunches, setWeekPunches] = useState<WeekPunch[]>([])
  const [weekAbsent, setWeekAbsent] = useState<string[]>([])
  const [timesheetLoading, setTimesheetLoading] = useState(false)

  // Adjustment request
  const [showAdjModal, setShowAdjModal] = useState(false)
  const [corrections, setCorrections] = useState<CorrEntry[]>([{ id: '1', dateStr: todayDateStr(), type: 'clock_in', time: '' }])
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [adjNotes, setAdjNotes] = useState('')
  const [adjSubmitting, setAdjSubmitting] = useState(false)

  // Clock ticker
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Restore active punch on load (handles app reload while clocked in)
  async function loadActivePunch(pId: string, uId: string) {
    try {
      const res = await apiFetch(`/api/time-punches/live?practiceId=${pId}`)
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data)) return
      const active = data.find((p: { userId: string }) => p.userId === uId)
      if (!active) return
      setPunch({
        id: active.id,
        punchIn: active.punchIn,
        locationId: active.locationId,
        specialty: active.specialty ?? undefined,
        isTardy: active.isTardy ?? false,
      })
      if (active.location) {
        setLocations(prev =>
          prev.find(l => l.id === active.locationId)
            ? prev
            : [...prev, { id: active.locationId, name: active.location.name }]
        )
      }
      const wasOnBreak = !!(active.breakStart && !active.breakEnd)
      setOnBreak(wasOnBreak)
      const log: LogEntry[] = [{ event: 'clockIn', time: new Date(active.punchIn) }]
      if (active.breakStart) log.push({ event: 'breakStart', time: new Date(active.breakStart) })
      if (active.breakEnd) log.push({ event: 'breakEnd', time: new Date(active.breakEnd) })
      setBreakLog(log)
    } catch { /* silent */ }
  }

  // Fetch practice settings + locations when auth is ready
  useEffect(() => {
    if (!practiceId || !userId) return
    loadActivePunch(practiceId, userId)
    apiFetch(`/api/practice/${practiceId}`)
      .then(r => r.json())
      .then(data => {
        if (data?.name) setPracticeName(data.name)
        if (typeof data?.requireSpecialty === 'boolean') setRequireSpecialty(data.requireSpecialty)
      })
      .catch(() => {})
    apiFetch(`/api/locations?practiceId=${practiceId}`)
      .then(r => r.json())
      .then((data: Location[]) => {
        if (Array.isArray(data) && data.length > 0) setLocations(data)
        else setLocations(TEST_LOCATIONS)
      })
      .catch(() => setLocations(TEST_LOCATIONS))
  }, [practiceId, userId])

  // Fetch weekly timesheet when panel opens
  useEffect(() => {
    if (!showTimesheet || !practiceId || !userId) return
    setTimesheetLoading(true)
    apiFetch(`/api/time-punches/mine?practiceId=${practiceId}&userId=${userId}`)
      .then(r => r.json())
      .then(data => {
        setWeekPunches(Array.isArray(data.punches) ? data.punches : [])
        setWeekAbsent(Array.isArray(data.absentDates) ? data.absentDates : [])
      })
      .catch(() => {})
      .finally(() => setTimesheetLoading(false))
  }, [showTimesheet, practiceId, userId])


  async function handleClockIn(): Promise<boolean> {
    if (!selectedLocation || !practiceId || !userId) return false
    setClockingIn(true)
    const now = new Date()
    try {
      const res = await apiFetch('/api/time-punches', {
        method: 'POST',
        body: JSON.stringify({
          practiceId,
          userId,
          locationId: selectedLocation,
          specialty: selectedSpecialty ?? undefined,
          punchIn: now.toISOString(),
        }),
      })

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        const staleId: string | undefined = body?.punchId

        // Check live endpoint — only returns today's open punches
        const liveRes = await apiFetch(`/api/time-punches/live?practiceId=${practiceId}`)
        const liveData = liveRes.ok ? await liveRes.json().catch(() => []) : []
        const todayPunch = Array.isArray(liveData)
          ? liveData.find((p: { userId: string }) => p.userId === userId)
          : null

        if (todayPunch) {
          // Restore today's active punch
          setPunch({ id: todayPunch.id, punchIn: todayPunch.punchIn, locationId: todayPunch.locationId, specialty: todayPunch.specialty ?? undefined, isTardy: todayPunch.isTardy ?? false })
          if (todayPunch.location) setLocations(prev => prev.find(l => l.id === todayPunch.locationId) ? prev : [...prev, { id: todayPunch.locationId, name: todayPunch.location.name }])
          setOnBreak(!!(todayPunch.breakStart && !todayPunch.breakEnd))
          const log: LogEntry[] = [{ event: 'clockIn', time: new Date(todayPunch.punchIn) }]
          if (todayPunch.breakStart) log.push({ event: 'breakStart', time: new Date(todayPunch.breakStart) })
          if (todayPunch.breakEnd) log.push({ event: 'breakEnd', time: new Date(todayPunch.breakEnd) })
          setBreakLog(log)
          return true
        }

        // Stale open punch from a previous day — offer to close it
        if (staleId) {
          return new Promise<boolean>((resolve) => {
            Alert.alert(
              'Unclosed Punch Found',
              'You have an open punch from a previous shift. Close it to clock in now?',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                {
                  text: 'Close & Clock In',
                  onPress: async () => {
                    try {
                      await apiFetch(`/api/time-punches/${staleId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ punchOut: new Date().toISOString() }),
                      })
                      const res2 = await apiFetch('/api/time-punches', {
                        method: 'POST',
                        body: JSON.stringify({ practiceId, userId, locationId: selectedLocation, specialty: selectedSpecialty ?? undefined, punchIn: new Date().toISOString() }),
                      })
                      if (res2.ok) {
                        const data: TimePunch = await res2.json()
                        setPunch(data)
                        setBreakLog([{ event: 'clockIn', time: new Date() }])
                        resolve(true)
                      } else {
                        Alert.alert('Error', 'Could not clock in after closing previous punch.')
                        resolve(false)
                      }
                    } catch {
                      Alert.alert('Error', 'Could not close previous punch.')
                      resolve(false)
                    }
                  },
                },
              ]
            )
          })
        }

        return false
      }

      if (res.ok) {
        const data: TimePunch = await res.json()
        setPunch(data)
        setBreakLog([{ event: 'clockIn', time: now }])
        return true
      }

      let msg = `Server error (${res.status})`
      try { const e = await res.json(); if (e?.error) msg = e.error } catch {}
      Alert.alert('Clock-In Failed', msg)
      return false
    } catch {
      Alert.alert('Connection Error', 'Could not reach the server. Check that the app and API are on the same network.')
      return false
    } finally {
      setClockingIn(false)
    }
  }

  async function handleBeginMeal() {
    if (!punch || onBreak) return
    setBreakLoading(true)
    try {
      const n = new Date()
      await apiFetch(`/api/time-punches/${punch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ breakStart: n.toISOString() }),
      })
      setBreakLog(prev => [...prev, { event: 'breakStart', time: n }])
      setOnBreak(true)
    } catch { /* swallow */ }
    finally { setBreakLoading(false) }
  }

  async function handleEndMeal() {
    if (!punch || !onBreak) return
    setBreakLoading(true)
    try {
      const n = new Date()
      await apiFetch(`/api/time-punches/${punch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ breakEnd: n.toISOString() }),
      })
      setBreakLog(prev => [...prev, { event: 'breakEnd', time: n }])
      setOnBreak(false)
    } catch { /* swallow */ }
    finally { setBreakLoading(false) }
  }

  async function handleClockOut() {
    if (!punch) return
    setClockingOut(true)
    const punchId = punch.id
    setPunch(null); setOnBreak(false); setBreakLog([])
    setSelectedLocation(null); setSelectedSpecialty(null)
    setClockingOut(false)
    if (!punchId.startsWith('local-')) {
      try {
        await apiFetch(`/api/time-punches/${punchId}`, {
          method: 'PATCH',
          body: JSON.stringify({ punchOut: new Date().toISOString() }),
        })
      } catch { /* API unavailable */ }
    }
  }

  function addCorr() {
    setCorrections(prev => [...prev, { id: String(Date.now()), dateStr: todayDateStr(), type: 'clock_in', time: '' }])
  }

  function removeCorr(id: string) {
    setCorrections(prev => prev.filter(c => c.id !== id))
  }

  function updateCorr<K extends keyof CorrEntry>(id: string, key: K, value: CorrEntry[K]) {
    setCorrections(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c))
  }

  async function handleSubmitAdj() {
    for (const c of corrections) {
      if (!parseDateStr(c.dateStr)) {
        Alert.alert('Invalid date', `"${c.dateStr}" — use format M/D/YYYY (e.g. 8/28/2026)`)
        return
      }
      if (!c.time.trim()) {
        Alert.alert('Missing time', 'Enter a time for each correction row.')
        return
      }
      const baseDate = parseDateStr(c.dateStr)!
      if (!parseTimeStr(c.time, baseDate)) {
        Alert.alert('Invalid time', `"${c.time}" — use H:MM AM or H:MM PM (e.g. 9:00 AM)`)
        return
      }
    }
    setAdjSubmitting(true)
    try {
      for (const c of corrections) {
        const baseDate = parseDateStr(c.dateStr)!
        const parsed = parseTimeStr(c.time, baseDate)!
        const isIn = c.type === 'clock_in' || c.type === 'begin_meal'
        await apiFetch('/api/clock-adjustments', {
          method: 'POST',
          body: JSON.stringify({
            practiceId,
            userId,
            date: baseDate.toISOString().split('T')[0],
            type: CORR_TO_ADJ[c.type],
            notes: adjNotes.trim() || CORR_LABELS[c.type],
            correctedPunchIn: isIn ? parsed.toISOString() : null,
            correctedPunchOut: isIn ? null : parsed.toISOString(),
          }),
        })
      }
      Alert.alert('Submitted', 'Your time correction has been sent to your manager.')
      setShowAdjModal(false)
      setCorrections([{ id: '1', dateStr: todayDateStr(), type: 'clock_in', time: '' }])
      setAdjNotes('')
      setOpenDropdownId(null)
    } catch {
      Alert.alert('Error', 'Could not submit. Please try again.')
    } finally {
      setAdjSubmitting(false)
    }
  }

  // Timesheet helpers
  const weekDays = getWeekDays()
  const today = new Date()

  function punchForDay(day: Date): WeekPunch | undefined {
    return weekPunches.find(p => new Date(p.punchIn).toDateString() === day.toDateString())
  }

  function isAbsent(day: Date): boolean {
    return weekAbsent.includes(day.toISOString().split('T')[0])
  }

  const totalWeekMs = weekPunches.reduce((sum, p) => sum + punchDurationMs(p), 0)

  const activeLocation = locations.find(l => l.id === punch?.locationId)
  const canClockIn = !!selectedLocation && (!requireSpecialty || !!selectedSpecialty) && !clockingIn

  // ---- ACTIVE STATE ----
  if (punch) {
    return (
      <View style={styles.activeRoot}>
        <SafeAreaView style={styles.activeTealSection} edges={['top']}>
          <Text style={styles.clockedInLabel}>{onBreak ? 'Lunch' : 'Clocked In'}</Text>
          <Text style={styles.activeSubtitle}>{activeLocation?.name ?? ''}</Text>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.activeScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.activeCard}>
            <View style={styles.punchActionRow}>
              <TouchableOpacity
                style={[styles.mealBtn, onBreak && styles.mealBtnDisabled]}
                onPress={handleBeginMeal}
                disabled={onBreak || breakLoading}
              >
                {breakLoading && !onBreak
                  ? <ActivityIndicator color="#D97706" size="small" />
                  : <Text style={[styles.mealBtnText, onBreak && styles.mealBtnTextDisabled]}>Begin Meal</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mealBtn, !onBreak && styles.mealBtnDisabled]}
                onPress={handleEndMeal}
                disabled={!onBreak || breakLoading}
              >
                {breakLoading && onBreak
                  ? <ActivityIndicator color="#D97706" size="small" />
                  : <Text style={[styles.mealBtnText, !onBreak && styles.mealBtnTextDisabled]}>End Meal</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.clockOutBtn, clockingOut && styles.clockOutBtnDisabled]}
                onPress={handleClockOut}
                disabled={clockingOut}
              >
                {clockingOut
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.clockOutBtnText}>Clock Out</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.logCard}>
            <Text style={styles.logTitle}>TIME LOG</Text>
            {breakLog.map((entry, i) => (
              <View key={i} style={styles.logRow}>
                <View style={[styles.logDot, { backgroundColor: LOG_COLORS[entry.event] }]} />
                <Text style={styles.logTime}>{formatLogTime(entry.time)}</Text>
                <Text style={styles.logLabel}>{LOG_LABELS[entry.event]}</Text>
                {entry.event === 'clockIn' && punch.isTardy && <Text style={styles.tardyText}>Tardy</Text>}
              </View>
            ))}
          </View>
        </ScrollView>
        <BottomNav activeRoute="index" />
      </View>
    )
  }

  // ---- IDLE STATE ----
  return (
    <View style={styles.idleRoot}>
      <SafeAreaView style={styles.idleTopArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.idleScroll} keyboardShouldPersistTaps="handled">
          {/* Brand header */}
          <View style={styles.brandHeader}>
            <View style={styles.brandRow}>
              <View style={styles.logoMark}>
                <WaveLine color="#A8D5E2" p0={{x:8,y:18}} p1={{x:18,y:12}} p2={{x:28,y:18}} p3={{x:38,y:24}} p4={{x:46,y:18}} />
                <WaveLine color="#5BA4BE" p0={{x:8,y:26}} p1={{x:20,y:19}} p2={{x:32,y:26}} p3={{x:40,y:31}} p4={{x:46,y:26}} />
                <WaveLine color="#8BAF9A" p0={{x:8,y:34}} p1={{x:16,y:28}} p2={{x:26,y:34}} p3={{x:36,y:40}} p4={{x:46,y:34}} />
              </View>
              <Text style={styles.brandName}>BRISA</Text>
            </View>
            {practiceName ? <Text style={styles.practiceNameText}>{practiceName}</Text> : null}
          </View>

          {/* Time + date */}
          <View style={styles.timeSection}>
            <Text style={styles.timeText}>{formatTime(now)}</Text>
            <Text style={styles.dateText}>{formatDate(now)}</Text>
          </View>

          {weekPunches.some(p => new Date(p.punchIn).toDateString() === today.toDateString() && p.punchOut !== null) && (
            <View style={styles.clockedOutBadge}>
              <Text style={styles.clockedOutBadgeText}>Clocked Out</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.clockInBtn}
            onPress={() => { setSelectedLocation(null); setSelectedSpecialty(null); setShowLocationDropdown(false); setShowSpecialtyDropdown(false); setShowClockInModal(true) }}
          >
            <Text style={styles.clockInBtnText}>CLOCK IN</Text>
          </TouchableOpacity>

          {/* Time correction link */}
          <TouchableOpacity style={styles.adjLink} onPress={() => setShowAdjModal(true)}>
            <Text style={styles.adjLinkText}>Report a missed punch</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>

      <BottomNav />

      {/* Clock-in modal with location + specialty dropdowns */}
      <Modal visible={showClockInModal} transparent animationType="slide" onRequestClose={() => setShowClockInModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowClockInModal(false)}>
          <TouchableOpacity style={styles.clockInSheet} activeOpacity={1}>
            <View style={styles.locationSheetHandle} />
            <Text style={styles.clockInSheetTitle}>CLOCK IN</Text>

            {/* Location dropdown */}
            <View style={styles.adjField}>
              <Text style={styles.adjFieldLabel}>Location</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => { setShowLocationDropdown(v => !v); setShowSpecialtyDropdown(false) }}
              >
                <Text style={selectedLocation ? styles.dropdownValue : styles.dropdownPlaceholder}>
                  {selectedLocation ? (locations.find(l => l.id === selectedLocation)?.name ?? 'Select location') : 'Select location'}
                </Text>
                {locations.length === 0
                  ? <ActivityIndicator size="small" color="#8BAF9A" />
                  : <Text style={styles.dropdownArrow}>{showLocationDropdown ? '▲' : '▼'}</Text>}
              </TouchableOpacity>
              {showLocationDropdown && (
                <View style={styles.dropdownList}>
                  {locations.map((loc, i) => (
                    <TouchableOpacity
                      key={loc.id}
                      style={[styles.dropdownItem, i < locations.length - 1 && styles.dropdownItemBorder]}
                      onPress={() => { setSelectedLocation(loc.id); setShowLocationDropdown(false) }}
                    >
                      <Text style={[styles.dropdownItemText, selectedLocation === loc.id && styles.dropdownItemTextSelected]}>
                        {loc.name}
                      </Text>
                      {selectedLocation === loc.id && <Text style={styles.dropdownItemCheck}>{'✓'}</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Specialty dropdown — only when required */}
            {requireSpecialty && (
              <View style={styles.adjField}>
                <Text style={styles.adjFieldLabel}>Specialty</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => { setShowSpecialtyDropdown(v => !v); setShowLocationDropdown(false) }}
                >
                  <Text style={selectedSpecialty ? styles.dropdownValue : styles.dropdownPlaceholder}>
                    {selectedSpecialty ?? 'Select specialty'}
                  </Text>
                  <Text style={styles.dropdownArrow}>{showSpecialtyDropdown ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showSpecialtyDropdown && (
                  <View style={styles.dropdownList}>
                    {SPECIALTIES.map((sp, i) => (
                      <TouchableOpacity
                        key={sp}
                        style={[styles.dropdownItem, i < SPECIALTIES.length - 1 && styles.dropdownItemBorder]}
                        onPress={() => { setSelectedSpecialty(sp); setShowSpecialtyDropdown(false) }}
                      >
                        <Text style={[styles.dropdownItemText, selectedSpecialty === sp && styles.dropdownItemTextSelected]}>
                          {sp}
                        </Text>
                        {selectedSpecialty === sp && <Text style={styles.dropdownItemCheck}>{'✓'}</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.clockInBtn, !canClockIn && styles.clockInBtnDisabled, { marginHorizontal: 0, marginTop: 8 }]}
              onPress={async () => { const ok = await handleClockIn(); if (ok) setShowClockInModal(false) }}
              disabled={!canClockIn}
            >
              {clockingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.clockInBtnText}>CONFIRM CLOCK IN</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Adjustment request modal */}
      <Modal visible={showAdjModal} transparent animationType="slide" onRequestClose={() => setShowAdjModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => { setShowAdjModal(false); setOpenDropdownId(null) }}>
            <TouchableOpacity style={styles.adjSheet} activeOpacity={1}>
              <View style={styles.locationSheetHandle} />
              <Text style={styles.adjSheetTitle}>REQUEST TIME CORRECTION</Text>

              {/* Column headers */}
              <View style={styles.corrHeaderRow}>
                <Text style={[styles.adjFieldLabel, styles.corrColDate]}>Date</Text>
                <Text style={[styles.adjFieldLabel, styles.corrColType]}>Correction</Text>
                <Text style={[styles.adjFieldLabel, styles.corrColTime]}>Time</Text>
              </View>

              {/* One row per correction */}
              {corrections.map((c) => (
                  <View key={c.id}>
                    <View style={styles.corrRow}>
                    {/* Date text input */}
                    <TextInput
                      style={[styles.adjTimeInput, styles.corrColDate]}
                      placeholder="M/D/YYYY"
                      placeholderTextColor="#555"
                      value={c.dateStr}
                      onChangeText={v => updateCorr(c.id, 'dateStr', v)}
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />

                    {/* Type dropdown */}
                    <View style={[styles.corrColType, { zIndex: openDropdownId === c.id ? 10 : 1 }]}>
                      <TouchableOpacity
                        style={styles.corrTypeBtn}
                        onPress={() => setOpenDropdownId(openDropdownId === c.id ? null : c.id)}
                      >
                        <Text style={styles.corrTypeBtnText} numberOfLines={1}>{CORR_LABELS[c.type]}</Text>
                        <Text style={styles.corrDropArrow}>▾</Text>
                      </TouchableOpacity>
                      {openDropdownId === c.id && (
                        <View style={styles.corrDropdown}>
                          {CORR_TYPES.map(t => (
                            <TouchableOpacity
                              key={t}
                              style={styles.corrDropItem}
                              onPress={() => { updateCorr(c.id, 'type', t); setOpenDropdownId(null) }}
                            >
                              <Text style={[styles.corrDropItemText, c.type === t && styles.corrDropItemSelected]}>
                                {CORR_LABELS[t]}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Time input */}
                    <TextInput
                      style={[styles.adjTimeInput, styles.corrColTime]}
                      placeholder="9:00 AM"
                      placeholderTextColor="#555"
                      value={c.time}
                      onChangeText={v => updateCorr(c.id, 'time', v)}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />

                    {/* Remove */}
                    {corrections.length > 1 && (
                      <TouchableOpacity onPress={() => removeCorr(c.id)} style={styles.corrRemoveBtn}>
                        <Text style={styles.corrRemoveText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  </View>
              ))}

              {/* Add row */}
              <TouchableOpacity style={styles.addCorrBtn} onPress={addCorr}>
                <Text style={styles.addCorrText}>+ Add Correction</Text>
              </TouchableOpacity>

              {/* Notes */}
              <View style={styles.adjField}>
                <Text style={styles.adjFieldLabel}>Notes</Text>
                <TextInput
                  style={styles.adjNotesInput}
                  placeholder="Describe what happened…"
                  placeholderTextColor="#555"
                  value={adjNotes}
                  onChangeText={setAdjNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Actions */}
              <View style={styles.adjActions}>
                <TouchableOpacity style={styles.adjCancelBtn} onPress={() => { setShowAdjModal(false); setOpenDropdownId(null) }}>
                  <Text style={styles.adjCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adjSubmitBtn, adjSubmitting && styles.adjSubmitBtnDisabled]}
                  onPress={handleSubmitAdj}
                  disabled={adjSubmitting}
                >
                  {adjSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.adjSubmitText}>Submit Request</Text>}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  // Idle
  idleRoot: { flex: 1, backgroundColor: '#4A5C52' },
  idleTopArea: { flex: 1 },
  idleScroll: { flexGrow: 1, paddingBottom: 24 },

  // Brand header
  brandHeader: { alignItems: 'center', paddingTop: 56, paddingBottom: 12, gap: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoMark: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#2C3E3A', alignItems: 'center', justifyContent: 'center', gap: 0, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  brandName: { fontSize: 38, fontWeight: '300', color: '#FAF6EF', letterSpacing: 8 },
  practiceNameText: { fontSize: 13, fontWeight: '400', color: '#9A9A96', letterSpacing: 0.5 },

  // Time
  timeSection: { alignItems: 'center', paddingTop: 64, paddingBottom: 28 },
  timeText: { fontSize: 44, fontWeight: '200', color: '#FAF6EF', letterSpacing: 4 },
  dateText: { fontSize: 17, fontWeight: '300', color: '#9A9A96', marginTop: 8, letterSpacing: 2 },

  clockedOutBadge: { alignSelf: 'center', backgroundColor: '#2A2A27', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 18, marginBottom: 20 },
  clockedOutBadgeText: { color: '#9A9A96', fontSize: 13, fontWeight: '500', letterSpacing: 1 },

  // Clock in button
  clockInBtn: { backgroundColor: '#1D9E75', borderRadius: 10, paddingVertical: 18, marginHorizontal: 90, alignItems: 'center' },
  clockInBtnDisabled: { backgroundColor: '#5A6B61' },
  clockInBtnText: { color: '#fff', fontSize: 13, fontWeight: '500', letterSpacing: 5 },

  // Clock-in modal sheet
  clockInSheet: { backgroundColor: '#1E1E1C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 16 },
  clockInSheetTitle: { fontSize: 11, fontWeight: '600', color: '#9A9A96', letterSpacing: 4, textAlign: 'center' },

  // Location / specialty dropdown (used inside modal)
  dropdownSection: { marginHorizontal: 24, marginBottom: 12 },
  dropdownLabel: { fontSize: 11, fontWeight: '600', color: '#8BAF9A', letterSpacing: 1.5, marginBottom: 6 },
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#2C3E3A', borderWidth: 1, borderColor: '#3D5045', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14 },
  dropdownPlaceholder: { fontSize: 15, color: '#6B7B72', flex: 1 },
  dropdownValue: { fontSize: 15, color: '#FAF6EF', fontWeight: '500', flex: 1 },
  dropdownArrow: { fontSize: 10, color: '#8BAF9A', marginLeft: 8 },
  dropdownList: { backgroundColor: '#2C3E3A', borderWidth: 1, borderColor: '#3D5045', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: '#3D5045' },
  dropdownItemText: { fontSize: 15, color: '#C8D5CF', fontWeight: '400' },
  dropdownItemTextSelected: { color: '#FAF6EF', fontWeight: '600' },
  dropdownItemCheck: { fontSize: 14, color: '#1D9E75', fontWeight: '700' },

  // Adjustment link
  adjLink: { alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  adjLinkText: { color: '#8BAF9A', fontSize: 13, fontWeight: '400', textDecorationLine: 'underline' },

  // Timesheet card
  timesheetCard: { marginHorizontal: 20, marginTop: 20, borderRadius: 14, backgroundColor: '#2C3E3A', overflow: 'hidden' },
  timesheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  timesheetTitle: { fontSize: 11, fontWeight: '600', color: '#8BAF9A', letterSpacing: 2 },
  timesheetHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timesheetTotal: { fontSize: 13, fontWeight: '600', color: '#FAF6EF' },
  timesheetChevron: { fontSize: 10, color: '#8BAF9A' },
  timesheetBody: { borderTopWidth: 1, borderTopColor: '#3D5045' },
  timesheetRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  timesheetRowBorder: { borderBottomWidth: 1, borderBottomColor: '#3D5045' },
  timesheetDayCol: { width: 56 },
  timesheetDayName: { fontSize: 13, fontWeight: '600', color: '#FAF6EF' },
  timesheetToday: { color: '#1D9E75' },
  timesheetDayDate: { fontSize: 11, color: '#8BAF9A', marginTop: 2 },
  timesheetPunchCol: { flex: 1, marginLeft: 12 },
  timesheetPunchTimes: { fontSize: 13, color: '#FAF6EF', fontWeight: '400' },
  timesheetPunchDuration: { fontSize: 11, color: '#8BAF9A', marginTop: 2 },
  timesheetAbsent: { fontSize: 13, color: '#EF4444', fontStyle: 'italic' },
  timesheetFuture: { fontSize: 13, color: '#5A6B61' },

  // Location modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  locationSheet: { backgroundColor: '#1E1E1C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 16 },
  locationSheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#4A5C52', alignSelf: 'center', marginBottom: 8 },
  locationSheetTitle: { fontSize: 11, fontWeight: '500', color: '#9A9A96', letterSpacing: 4, textAlign: 'center' },
  locationChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#2E3D35', borderWidth: 1, borderColor: '#3D5045' },
  chipSelected: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1D9E75', borderWidth: 1, borderColor: '#1D9E75' },
  chipText: { fontSize: 13, color: '#FAF6EF', fontWeight: '500' },
  chipTextSelected: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // Adjustment modal
  adjSheet: { backgroundColor: '#1E1E1C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 14 },
  adjSheetTitle: { fontSize: 11, fontWeight: '600', color: '#9A9A96', letterSpacing: 4, textAlign: 'center' },
  adjField: { gap: 6 },
  adjFieldLabel: { fontSize: 11, fontWeight: '600', color: '#8BAF9A', letterSpacing: 0.5 },
  adjTimeInput: { borderWidth: 1, borderColor: '#3D5045', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: '#FAF6EF', backgroundColor: '#2C3E3A' },
  adjNotesInput: { borderWidth: 1, borderColor: '#3D5045', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#FAF6EF', backgroundColor: '#2C3E3A', minHeight: 70, textAlignVertical: 'top' },
  adjActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  adjCancelBtn: { flex: 1, borderWidth: 1, borderColor: '#3D5045', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  adjCancelText: { fontSize: 14, color: '#8BAF9A', fontWeight: '500' },
  adjSubmitBtn: { flex: 2, backgroundColor: '#1D9E75', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  adjSubmitBtnDisabled: { opacity: 0.5 },
  adjSubmitText: { fontSize: 14, color: '#fff', fontWeight: '600' },

  // Correction rows
  corrHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, gap: 8 },
  corrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  corrColDate: { width: 110 },
  corrColType: { flex: 1 },
  corrColTime: { width: 80 },
  corrDateText: { fontSize: 12, fontWeight: '500', color: '#FAF6EF' },
  corrTypeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#3D5045', borderRadius: 8, backgroundColor: '#2C3E3A', paddingHorizontal: 10, paddingVertical: 9 },
  corrTypeBtnText: { fontSize: 13, color: '#FAF6EF', flex: 1 },
  corrDropArrow: { fontSize: 11, color: '#8BAF9A', marginLeft: 4 },
  corrDropdown: { position: 'absolute', top: 40, left: 0, right: 0, backgroundColor: '#2C3E3A', borderWidth: 1, borderColor: '#3D5045', borderRadius: 8, zIndex: 100, marginTop: 2 },
  corrDropItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#3D5045' },
  corrDropItemText: { fontSize: 13, color: '#9A9A96' },
  corrDropItemSelected: { color: '#1D9E75', fontWeight: '600' },
  corrRemoveBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  corrRemoveText: { fontSize: 20, color: '#9A9A96', lineHeight: 22 },
  addCorrBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  addCorrText: { fontSize: 13, color: '#1D9E75', fontWeight: '500' },

  // Active state
  activeRoot: { flex: 1, backgroundColor: '#4A5C52' },
  activeTealSection: { backgroundColor: '#1D9E75', paddingBottom: 32, alignItems: 'center', paddingTop: 48 },
  clockedInLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '500', marginBottom: 8, letterSpacing: 5 },

  activeSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '300', letterSpacing: 2, marginTop: 10 },
  tardyText: { fontSize: 12, color: '#DC2626', fontStyle: 'italic', marginLeft: 4 },
  activeScroll: { paddingTop: 16, paddingBottom: 40 },
  activeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginHorizontal: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, gap: 12 },

  // Punch actions (Begin Meal / End Meal / Clock Out)
  punchActionRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  mealBtn: { flex: 1, borderWidth: 1.5, borderColor: '#D97706', borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  mealBtnDisabled: { borderColor: '#E0E0E0', backgroundColor: '#F9F9F9' },
  mealBtnText: { color: '#D97706', fontSize: 13, fontWeight: '600' },
  mealBtnTextDisabled: { color: '#C0C0C0' },

  clockOutBtn: { flex: 1, backgroundColor: '#A32D2D', borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  clockOutBtnDisabled: { flex: 1, backgroundColor: '#C97070', borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  clockOutBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Log
  logCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginHorizontal: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 12 },
  logTitle: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logDot: { width: 10, height: 10, borderRadius: 5 },
  logTime: { fontSize: 13, fontWeight: '600', color: '#555', width: 80 },
  logLabel: { fontSize: 13, color: '#2C2C2A', flex: 1 },
})
