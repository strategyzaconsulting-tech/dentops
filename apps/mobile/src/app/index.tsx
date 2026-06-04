import { useEffect, useRef, useState } from 'react'
import BottomNav from '../components/BottomNav'
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const USER_ID = '165234da-d643-41e8-8ec8-6e400d18a1d2'
const API_BASE = 'http://192.168.0.137:3000'

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

interface Location { id: string; name: string; address?: string; city?: string; state?: string }
interface TimePunch { id: string; punchIn: string; locationId: string; specialty?: string; isTardy?: boolean }
interface LogEntry { event: 'clockIn' | 'breakStart' | 'breakEnd'; time: Date }
type TimerOption = 'none' | number | 'custom'

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

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

interface Pt { x: number; y: number }

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

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function HomeScreen() {
  const [now, setNow] = useState(new Date())
  const [practiceName, setPracticeName] = useState<string | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [clockingIn, setClockingIn] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
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

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/api/practice/${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((data) => { if (data?.name) setPracticeName(data.name) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/api/locations?practiceId=${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((data: Location[]) => {
        if (Array.isArray(data) && data.length > 0) setLocations(data)
        else setLocations(TEST_LOCATIONS)
      })
      .catch(() => setLocations(TEST_LOCATIONS))
  }, [])

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
      const res = await fetch(`${API_BASE}/api/time-punches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: PRACTICE_ID, userId: USER_ID, locationId: selectedLocation, punchIn: punchIn.toISOString() }),
      })
      if (res.status === 409) {
        Alert.alert('Already Clocked In', "Please clock out before starting a new shift.")
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
      const now = new Date()
      const body = onBreak ? { breakEnd: now.toISOString() } : { breakStart: now.toISOString() }
      await fetch(`${API_BASE}/api/time-punches/${punch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!onBreak) {
        setBreakLog((prev) => [...prev, { event: 'breakStart', time: now }])
        const mins = resolvedTimerMins()
        if (mins !== null) startMealTimer(mins, alertVibrate)
      } else {
        setBreakLog((prev) => [...prev, { event: 'breakEnd', time: now }])
        stopMealTimer()
      }
      setOnBreak((prev) => !prev)
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
    setTimerOption('none'); setCustomInput(''); setSelectedLocation(null); setClockingOut(false)
    if (!punchId.startsWith('local-')) {
      try {
        await fetch(`${API_BASE}/api/time-punches/${punchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ punchOut: new Date().toISOString() }),
        })
      } catch { /* API unavailable */ }
    }
  }

  const activeLocation = locations.find((l) => l.id === punch?.locationId)
  const isCustomTimerInvalid = timerOption === 'custom' && customInput.length > 0 &&
    (isNaN(parseInt(customInput, 10)) || parseInt(customInput, 10) <= 0)

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
                  {(['none', ...PRESET_TIMER_MINS, 'custom'] as const).map((opt) => (
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
                    <TouchableOpacity style={alertVibrate ? styles.alertChipSelected : styles.alertChip} onPress={() => setAlertVibrate((v) => !v)}>
                      <Text style={alertVibrate ? styles.alertChipTextSelected : styles.alertChipText}>📳 Vibrate</Text>
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
          {/* Brisa brand header */}
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

          <TouchableOpacity style={styles.clockInBtn} onPress={() => { setSelectedLocation(null); setShowLocationPicker(true) }}>
            <Text style={styles.clockInBtnText}>CLOCK IN</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <BottomNav />

      <Modal visible={showLocationPicker} transparent animationType="slide" onRequestClose={() => setShowLocationPicker(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowLocationPicker(false)}>
          <TouchableOpacity style={styles.locationSheet} activeOpacity={1}>
            <View style={styles.locationSheetHandle} />
            <Text style={styles.locationSheetTitle}>SELECT LOCATION</Text>
            {locations.length === 0 ? (
              <ActivityIndicator color="#1D9E75" style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.locationChips}>
                {locations.map((loc) => {
                  const selected = selectedLocation === loc.id
                  return (
                    <TouchableOpacity key={loc.id} style={selected ? styles.chipSelected : styles.chip} onPress={() => setSelectedLocation(loc.id)}>
                      <Text style={selected ? styles.chipTextSelected : styles.chipText}>{loc.name}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
            <TouchableOpacity
              style={[styles.clockInBtn, (!selectedLocation || clockingIn) && styles.clockInBtnDisabled, { marginHorizontal: 0, marginTop: 8 }]}
              onPress={async () => { await handleClockIn(); setShowLocationPicker(false) }}
              disabled={!selectedLocation || clockingIn}
            >
              {clockingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.clockInBtnText}>CONFIRM CLOCK IN</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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
  timeSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 28 },
  timeText: { fontSize: 44, fontWeight: '200', color: '#FAF6EF', letterSpacing: 4 },
  dateText: { fontSize: 13, fontWeight: '300', color: '#9A9A96', marginTop: 6, letterSpacing: 2 },

  // Clock in button
  clockInBtn: { backgroundColor: '#1D9E75', borderRadius: 10, paddingVertical: 18, marginHorizontal: 90, alignItems: 'center' },
  clockInBtnDisabled: { backgroundColor: '#5A6B61' },
  clockInBtnText: { color: '#fff', fontSize: 13, fontWeight: '500', letterSpacing: 5 },

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
