import { useEffect, useRef, useState } from 'react'
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
  Vibration,
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

const PRESET_TIMER_MINS = [30, 60] as const

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

const ADJ_LABELS: Record<AdjType, string> = {
  missed_clock_in: 'Missed Clock-In',
  missed_clock_out: 'Missed Clock-Out',
  begin_meal: 'Begin Meal',
  end_meal: 'End Meal',
  wrong_time: 'Wrong Time',
  other: 'Other',
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Location { id: string; name: string; address?: string; city?: string; state?: string }
interface TimePunch { id: string; punchIn: string; locationId: string; specialty?: string; isTardy?: boolean }
interface LogEntry { event: 'clockIn' | 'breakStart' | 'breakEnd'; time: Date }
type TimerOption = 'none' | number | 'custom'

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

function parseTimeStr(str: string, base: Date): Date | null {
  const s = str.trim()
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = parseInt(ampm[2], 10)
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    const d = new Date(base); d.setHours(h, m, 0, 0); return d
  }
  const hhmm = s.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const d = new Date(base); d.setHours(parseInt(hhmm[1], 10), parseInt(hhmm[2], 10), 0, 0); return d
  }
  return null
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

function formatElapsed(punchIn: Date): string {
  const secs = Math.floor((Date.now() - punchIn.getTime()) / 1000)
  const h = Math.floor(secs / 3600).toString().padStart(2, '0')
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
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

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
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
  const [elapsed, setElapsed] = useState('00:00:00')
  const [onBreak, setOnBreak] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)
  const [breakLoading, setBreakLoading] = useState(false)
  const [breakLog, setBreakLog] = useState<LogEntry[]>([])
  const [timerOption, setTimerOption] = useState<TimerOption>('none')
  const [customInput, setCustomInput] = useState('')
  const [mealTimerRemaining, setMealTimerRemaining] = useState<number | null>(null)
  const [alertVibrate, setAlertVibrate] = useState(true)
  const mealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
  const [adjDate, setAdjDate] = useState(new Date())
  const [adjType, setAdjType] = useState<AdjType>('missed_clock_in')
  const [adjInTime, setAdjInTime] = useState('')
  const [adjOutTime, setAdjOutTime] = useState('')
  const [adjNotes, setAdjNotes] = useState('')
  const [adjSubmitting, setAdjSubmitting] = useState(false)

  // Clock ticker
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch practice settings + locations when auth is ready
  useEffect(() => {
    if (!practiceId) return
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
  }, [practiceId])

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

  // Elapsed timer while clocked in
  useEffect(() => {
    if (punch) {
      const punchInDate = new Date(punch.punchIn)
      setElapsed(formatElapsed(punchInDate))
      elapsedRef.current = setInterval(() => setElapsed(formatElapsed(punchInDate)), 1000)
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current) }
  }, [punch])

  useEffect(() => {
    return () => { if (mealTimerRef.current) clearInterval(mealTimerRef.current) }
  }, [])

  function resolvedTimerMins(): number | null {
    if (timerOption === 'none') return null
    if (timerOption === 'custom') {
      const v = parseInt(customInput, 10)
      return Number.isFinite(v) && v > 0 ? v : null
    }
    return timerOption as number
  }

  function startMealTimer(minutes: number, withVibrate: boolean) {
    let remaining = minutes * 60
    setMealTimerRemaining(remaining)
    if (mealTimerRef.current) clearInterval(mealTimerRef.current)
    mealTimerRef.current = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        clearInterval(mealTimerRef.current!)
        mealTimerRef.current = null
        setMealTimerRemaining(null)
        if (withVibrate) Vibration.vibrate([0, 500, 150, 500, 150, 700])
        Alert.alert('Meal Break Over', `Your ${minutes}-minute meal break has ended.`)
      } else {
        setMealTimerRemaining(remaining)
      }
    }, 1000)
  }

  function stopMealTimer() {
    if (mealTimerRef.current) { clearInterval(mealTimerRef.current); mealTimerRef.current = null }
    setMealTimerRemaining(null)
  }

  async function handleClockIn() {
    if (!selectedLocation) return
    setClockingIn(true)
    const punchIn = new Date()
    try {
      const res = await apiFetch('/api/time-punches', {
        method: 'POST',
        body: JSON.stringify({
          practiceId,
          userId,
          locationId: selectedLocation,
          specialty: selectedSpecialty ?? undefined,
          punchIn: punchIn.toISOString(),
        }),
      })
      if (res.status === 409) {
        Alert.alert('Already Clocked In', 'Please clock out before starting a new shift.')
        return
      }
      if (res.ok) {
        const data: TimePunch = await res.json()
        setPunch(data)
        setBreakLog([{ event: 'clockIn', time: punchIn }])
      }
    } catch {
      setPunch({ id: `local-${Date.now()}`, punchIn: punchIn.toISOString(), locationId: selectedLocation })
      setBreakLog([{ event: 'clockIn', time: punchIn }])
    } finally {
      setClockingIn(false)
    }
  }

  async function handleBreakToggle() {
    if (!punch) return
    if (!onBreak && timerOption === 'custom') {
      const v = parseInt(customInput, 10)
      if (!Number.isFinite(v) || v <= 0 || v > 480) {
        Alert.alert('Invalid timer', 'Enter a number of minutes between 1 and 480.')
        return
      }
    }
    setBreakLoading(true)
    try {
      const n = new Date()
      const body = onBreak ? { breakEnd: n.toISOString() } : { breakStart: n.toISOString() }
      await apiFetch(`/api/time-punches/${punch.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (!onBreak) {
        setBreakLog(prev => [...prev, { event: 'breakStart', time: n }])
        const mins = resolvedTimerMins()
        if (mins !== null) startMealTimer(mins, alertVibrate)
      } else {
        setBreakLog(prev => [...prev, { event: 'breakEnd', time: n }])
        stopMealTimer()
      }
      setOnBreak(prev => !prev)
    } catch { /* swallow */ }
    finally { setBreakLoading(false) }
  }

  async function handleClockOut() {
    if (!punch) return
    setClockingOut(true)
    stopMealTimer()
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    const punchId = punch.id
    setPunch(null); setOnBreak(false); setBreakLog([])
    setTimerOption('none'); setCustomInput('')
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

  async function handleSubmitAdj() {
    const corrIn = adjInTime.trim() ? parseTimeStr(adjInTime, adjDate) : null
    const corrOut = adjOutTime.trim() ? parseTimeStr(adjOutTime, adjDate) : null
    if (adjInTime.trim() && !corrIn) {
      Alert.alert('Invalid time', 'Use format like "9:00 AM" or "14:30"')
      return
    }
    if (adjOutTime.trim() && !corrOut) {
      Alert.alert('Invalid time', 'Use format like "5:00 PM" or "17:00"')
      return
    }
    setAdjSubmitting(true)
    try {
      const res = await apiFetch('/api/clock-adjustments', {
        method: 'POST',
        body: JSON.stringify({
          practiceId,
          userId,
          date: adjDate.toISOString().split('T')[0],
          type: adjType,
          notes: adjNotes.trim() || ADJ_LABELS[adjType],
          correctedPunchIn: corrIn?.toISOString() ?? null,
          correctedPunchOut: corrOut?.toISOString() ?? null,
        }),
      })
      if (res.ok) {
        Alert.alert('Submitted', 'Your time correction has been sent to your manager.')
        setShowAdjModal(false)
        setAdjNotes(''); setAdjInTime(''); setAdjOutTime('')
        setAdjDate(new Date()); setAdjType('missed_clock_in')
      } else {
        Alert.alert('Error', 'Could not submit. Please try again.')
      }
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
  const isCustomTimerInvalid = timerOption === 'custom' && customInput.length > 0 &&
    (isNaN(parseInt(customInput, 10)) || parseInt(customInput, 10) <= 0)
  const canClockIn = !!selectedLocation && (!requireSpecialty || !!selectedSpecialty) && !clockingIn

  // ---- ACTIVE STATE ----
  if (punch) {
    return (
      <View style={styles.activeRoot}>
        <SafeAreaView style={styles.activeTealSection} edges={['top']}>
          <Text style={styles.clockedInLabel}>CLOCKED IN</Text>
          <Text style={styles.elapsedText}>{elapsed}</Text>
          <Text style={styles.activeSubtitle}>{activeLocation?.name ?? ''}</Text>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.activeScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.activeCard}>
            {!onBreak && (
              <View style={styles.timerSection}>
                <Text style={styles.timerSectionLabel}>Meal timer</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timerChipRow}>
                  {(['none', ...PRESET_TIMER_MINS, 'custom'] as const).map(opt => (
                    <TouchableOpacity key={String(opt)} style={timerOption === opt ? styles.timerChipSelected : styles.timerChip} onPress={() => setTimerOption(opt)}>
                      <Text style={timerOption === opt ? styles.timerChipTextSelected : styles.timerChipText}>
                        {opt === 'none' ? 'None' : opt === 'custom' ? 'Custom' : `${opt}m`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {timerOption === 'custom' && (
                  <View style={styles.customInputRow}>
                    <TextInput style={[styles.customInput, isCustomTimerInvalid && styles.customInputError]} placeholder="Minutes" placeholderTextColor="#bbb" value={customInput} onChangeText={setCustomInput} keyboardType="number-pad" maxLength={3} />
                    <Text style={styles.customInputUnit}>min</Text>
                  </View>
                )}
                {timerOption !== 'none' && (
                  <View style={styles.alertToggleRow}>
                    <Text style={styles.alertToggleLabel}>Alert with</Text>
                    <TouchableOpacity style={alertVibrate ? styles.alertChipSelected : styles.alertChip} onPress={() => setAlertVibrate(v => !v)}>
                      <Text style={alertVibrate ? styles.alertChipTextSelected : styles.alertChipText}>ðŸ“³ Vibrate</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={onBreak ? styles.breakBtnActive : styles.breakBtnIdle} onPress={handleBreakToggle} disabled={breakLoading}>
              {breakLoading ? <ActivityIndicator color={onBreak ? '#fff' : '#D97706'} /> : (
                <Text style={onBreak ? styles.breakBtnActiveText : styles.breakBtnIdleText}>{onBreak ? 'End meal break' : 'Start meal break'}</Text>
              )}
            </TouchableOpacity>

            {onBreak && mealTimerRemaining !== null && (
              <View style={styles.countdownRow}>
                <View style={styles.countdownDot} />
                <Text style={styles.countdownText}>Break ends in {formatCountdown(mealTimerRemaining)}</Text>
              </View>
            )}

            <TouchableOpacity style={clockingOut ? styles.clockOutBtnDisabled : styles.clockOutBtn} onPress={handleClockOut} disabled={clockingOut}>
              {clockingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.clockOutBtnText}>Clock out</Text>}
            </TouchableOpacity>
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
        <BottomNav />
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

          {/* Weekly timesheet card */}
          <View style={styles.timesheetCard}>
            <TouchableOpacity style={styles.timesheetHeader} onPress={() => setShowTimesheet(v => !v)}>
              <Text style={styles.timesheetTitle}>MY HOURS THIS WEEK</Text>
              <View style={styles.timesheetHeaderRight}>
                {totalWeekMs > 0 && <Text style={styles.timesheetTotal}>{formatHours(totalWeekMs)}</Text>}
                <Text style={styles.timesheetChevron}>{showTimesheet ? 'â–²' : 'â–¼'}</Text>
              </View>
            </TouchableOpacity>

            {showTimesheet && (
              <View style={styles.timesheetBody}>
                {timesheetLoading ? (
                  <ActivityIndicator color="#1D9E75" style={{ marginVertical: 16 }} />
                ) : (
                  weekDays.map((day, i) => {
                    const p = punchForDay(day)
                    const absent = isAbsent(day)
                    const isToday = day.toDateString() === today.toDateString()
                    const isFuture = day > today
                    return (
                      <View key={i} style={[styles.timesheetRow, i < 6 && styles.timesheetRowBorder]}>
                        <View style={styles.timesheetDayCol}>
                          <Text style={[styles.timesheetDayName, isToday && styles.timesheetToday]}>{DAY_NAMES[i]}</Text>
                          <Text style={styles.timesheetDayDate}>{formatShortDate(day)}</Text>
                        </View>
                        <View style={styles.timesheetPunchCol}>
                          {p ? (
                            <>
                              <Text style={styles.timesheetPunchTimes}>
                                {formatHm(p.punchIn)} â€“ {p.punchOut ? formatHm(p.punchOut) : 'Active'}
                              </Text>
                              {punchDurationMs(p) > 0 && (
                                <Text style={styles.timesheetPunchDuration}>{formatHours(punchDurationMs(p))}</Text>
                              )}
                            </>
                          ) : absent ? (
                            <Text style={styles.timesheetAbsent}>Absent</Text>
                          ) : isFuture ? (
                            <Text style={styles.timesheetFuture}>â€”</Text>
                          ) : isToday ? (
                            <Text style={styles.timesheetFuture}>Not yet clocked in</Text>
                          ) : (
                            <Text style={styles.timesheetFuture}>â€”</Text>
                          )}
                        </View>
                      </View>
                    )
                  })
                )}
              </View>
            )}
          </View>
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
              onPress={async () => { await handleClockIn(); setShowClockInModal(false) }}
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
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowAdjModal(false)}>
            <TouchableOpacity style={styles.adjSheet} activeOpacity={1}>
              <View style={styles.locationSheetHandle} />
              <Text style={styles.adjSheetTitle}>REQUEST TIME CORRECTION</Text>

              {/* Date */}
              <View style={styles.adjField}>
                <Text style={styles.adjFieldLabel}>Date</Text>
                <View style={styles.adjDateRow}>
                  <TouchableOpacity onPress={() => {
                    const d = new Date(adjDate); d.setDate(d.getDate() - 1); setAdjDate(d)
                  }} style={styles.adjDateArrow}>
                    <Text style={styles.adjDateArrowText}>â€¹</Text>
                  </TouchableOpacity>
                  <Text style={styles.adjDateText}>{adjDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                  <TouchableOpacity onPress={() => {
                    const next = new Date(adjDate); next.setDate(next.getDate() + 1)
                    if (next <= new Date()) setAdjDate(next)
                  }} style={styles.adjDateArrow}>
                    <Text style={styles.adjDateArrowText}>â€º</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Type chips */}
              <View style={styles.adjField}>
                <Text style={styles.adjFieldLabel}>Type</Text>
                <View style={styles.adjTypeRow}>
                  {ADJ_TYPES.map(t => (
                    <TouchableOpacity key={t} style={adjType === t ? styles.adjTypeChipSelected : styles.adjTypeChip} onPress={() => setAdjType(t)}>
                      <Text style={adjType === t ? styles.adjTypeChipTextSelected : styles.adjTypeChipText}>{ADJ_LABELS[t]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Corrected times */}
              <View style={styles.adjTimeRow}>
                <View style={[styles.adjField, { flex: 1 }]}>
                  <Text style={styles.adjFieldLabel}>Corrected In</Text>
                  <TextInput
                    style={styles.adjTimeInput}
                    placeholder="e.g. 9:00 AM"
                    placeholderTextColor="#888"
                    value={adjInTime}
                    onChangeText={setAdjInTime}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={[styles.adjField, { flex: 1 }]}>
                  <Text style={styles.adjFieldLabel}>Corrected Out</Text>
                  <TextInput
                    style={styles.adjTimeInput}
                    placeholder="e.g. 5:00 PM"
                    placeholderTextColor="#888"
                    value={adjOutTime}
                    onChangeText={setAdjOutTime}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* Notes */}
              <View style={styles.adjField}>
                <Text style={styles.adjFieldLabel}>Notes</Text>
                <TextInput
                  style={styles.adjNotesInput}
                  placeholder="Describe what happenedâ€¦"
                  placeholderTextColor="#888"
                  value={adjNotes}
                  onChangeText={setAdjNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Actions */}
              <View style={styles.adjActions}>
                <TouchableOpacity style={styles.adjCancelBtn} onPress={() => setShowAdjModal(false)}>
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
  adjDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  adjDateArrow: { padding: 8 },
  adjDateArrowText: { fontSize: 22, color: '#8BAF9A', fontWeight: '300' },
  adjDateText: { fontSize: 15, fontWeight: '500', color: '#FAF6EF', minWidth: 140, textAlign: 'center' },
  adjTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  adjTypeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#2E3D35', borderWidth: 1, borderColor: '#3D5045' },
  adjTypeChipSelected: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1D9E75', borderWidth: 1, borderColor: '#1D9E75' },
  adjTypeChipText: { fontSize: 12, color: '#FAF6EF', fontWeight: '500' },
  adjTypeChipTextSelected: { fontSize: 12, color: '#fff', fontWeight: '600' },
  adjTimeRow: { flexDirection: 'row' },
  adjTimeInput: { borderWidth: 1, borderColor: '#3D5045', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#FAF6EF', backgroundColor: '#2C3E3A' },
  adjNotesInput: { borderWidth: 1, borderColor: '#3D5045', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#FAF6EF', backgroundColor: '#2C3E3A', minHeight: 70, textAlignVertical: 'top' },
  adjActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  adjCancelBtn: { flex: 1, borderWidth: 1, borderColor: '#3D5045', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  adjCancelText: { fontSize: 14, color: '#8BAF9A', fontWeight: '500' },
  adjSubmitBtn: { flex: 2, backgroundColor: '#1D9E75', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  adjSubmitBtnDisabled: { opacity: 0.5 },
  adjSubmitText: { fontSize: 14, color: '#fff', fontWeight: '600' },

  // Active state
  activeRoot: { flex: 1, backgroundColor: '#4A5C52' },
  activeTealSection: { backgroundColor: '#1D9E75', paddingBottom: 32, alignItems: 'center', paddingTop: 48 },
  clockedInLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '500', marginBottom: 8, letterSpacing: 5 },
  elapsedText: { color: '#fff', fontSize: 52, fontWeight: '200', letterSpacing: 4 },
  activeSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '300', letterSpacing: 2, marginTop: 10 },
  tardyText: { fontSize: 12, color: '#DC2626', fontStyle: 'italic', marginLeft: 4 },
  activeScroll: { paddingTop: 16, paddingBottom: 40 },
  activeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginHorizontal: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, gap: 12 },

  // Meal timer
  timerSection: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 16, gap: 10 },
  timerSectionLabel: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  timerChipRow: { gap: 8, paddingRight: 4 },
  timerChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  timerChipSelected: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#D97706', borderWidth: 1, borderColor: '#D97706' },
  timerChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  timerChipTextSelected: { fontSize: 13, color: '#fff', fontWeight: '700' },
  customInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '600', color: '#2C2C2A', backgroundColor: '#FAFAFA', width: 90, textAlign: 'center' },
  customInputError: { borderColor: '#EF4444' },
  customInputUnit: { fontSize: 14, color: '#888', fontWeight: '500' },
  alertToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertToggleLabel: { fontSize: 12, color: '#888', fontWeight: '500', marginRight: 4 },
  alertChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  alertChipSelected: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1D9E75', borderWidth: 1, borderColor: '#1D9E75' },
  alertChipText: { fontSize: 12, color: '#555', fontWeight: '500' },
  alertChipTextSelected: { fontSize: 12, color: '#fff', fontWeight: '600' },

  // Break
  breakBtnIdle: { borderWidth: 1.5, borderColor: '#D97706', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  breakBtnActive: { backgroundColor: '#D97706', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  breakBtnIdleText: { color: '#D97706', fontSize: 16, fontWeight: '600' },
  breakBtnActiveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 },
  countdownDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D97706' },
  countdownText: { fontSize: 15, fontWeight: '700', color: '#D97706' },
  clockOutBtn: { backgroundColor: '#A32D2D', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  clockOutBtnDisabled: { backgroundColor: '#C97070', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  clockOutBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Log
  logCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginHorizontal: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 12 },
  logTitle: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logDot: { width: 10, height: 10, borderRadius: 5 },
  logTime: { fontSize: 13, fontWeight: '600', color: '#555', width: 80 },
  logLabel: { fontSize: 13, color: '#2C2C2A', flex: 1 },
})
