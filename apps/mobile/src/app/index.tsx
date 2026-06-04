import { useEffect, useRef, useState } from 'react'
import BottomNav from '../components/BottomNav'
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {} from 'expo-router'
import { Audio, type AVPlaybackStatus } from 'expo-av'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const USER_ID = '165234da-d643-41e8-8ec8-6e400d18a1d2' // Daniel Quiroga (staff)
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

interface Location {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
}

interface TimePunch {
  id: string
  punchIn: string
  locationId: string
  specialty?: string
  isTardy?: boolean
}

interface LogEntry {
  event: 'clockIn' | 'breakStart' | 'breakEnd'
  time: Date
}

// 'none' | number (preset) | 'custom'
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
  const h12 = h % 12 || 12
  return `${h12}:${m}:${s} ${ampm}`
}

function formatLogTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

async function playBeep() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/beep.wav')
    )
    await sound.playAsync()
    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync()
      }
    })
  } catch {
    // silent fallback — vibration will still trigger if enabled
  }
}

export default function HomeScreen() {
  // --- shared clock state ---
  const [now, setNow] = useState(new Date())

  // --- practice branding + settings ---
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [practiceName, setPracticeName] = useState<string | null>(null)

  // --- idle state ---
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [clockingIn, setClockingIn] = useState(false)

  // --- active state ---
  const [punch, setPunch] = useState<TimePunch | null>(null)
  const [elapsed, setElapsed] = useState('00:00:00')
  const [onBreak, setOnBreak] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)
  const [breakLoading, setBreakLoading] = useState(false)

  // --- time log ---
  const [breakLog, setBreakLog] = useState<LogEntry[]>([])

  // --- meal timer ---
  const [timerOption, setTimerOption] = useState<TimerOption>('none')
  const [customInput, setCustomInput] = useState('')
  const [mealTimerRemaining, setMealTimerRemaining] = useState<number | null>(null)
  const mealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- alert preferences ---
  const [alertSound, setAlertSound] = useState(true)
  const [alertVibrate, setAlertVibrate] = useState(true)


  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Wall clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch practice branding on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/practice/${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.logoUrl) setLogoUrl(data.logoUrl)
        if (data?.name) setPracticeName(data.name)
      })
      .catch(() => {})
  }, [])

  // Fetch locations on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/locations?practiceId=${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((data: Location[]) => {
        if (Array.isArray(data) && data.length > 0) setLocations(data)
        else setLocations(TEST_LOCATIONS)
      })
      .catch(() => setLocations(TEST_LOCATIONS))
  }, [])


  // Elapsed timer while clocked in
  useEffect(() => {
    if (punch) {
      const punchInDate = new Date(punch.punchIn)
      setElapsed(formatElapsed(punchInDate))
      elapsedRef.current = setInterval(() => setElapsed(formatElapsed(punchInDate)), 1000)
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, [punch])

  // Cleanup meal timer on unmount
  useEffect(() => {
    return () => {
      if (mealTimerRef.current) clearInterval(mealTimerRef.current)
    }
  }, [])

  function resolvedTimerMins(): number | null {
    if (timerOption === 'none') return null
    if (timerOption === 'custom') {
      const v = parseInt(customInput, 10)
      return Number.isFinite(v) && v > 0 ? v : null
    }
    return timerOption as number
  }

  function startMealTimer(minutes: number, withSound: boolean, withVibrate: boolean) {
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
        if (withSound) playBeep()
        Alert.alert(
          'Meal Break Over',
          `Your ${minutes}-minute meal break has ended. Time to clock back in!`
        )
      } else {
        setMealTimerRemaining(remaining)
      }
    }, 1000)
  }

  function stopMealTimer() {
    if (mealTimerRef.current) {
      clearInterval(mealTimerRef.current)
      mealTimerRef.current = null
    }
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
        body: JSON.stringify({
          practiceId: PRACTICE_ID,
          userId: USER_ID,
          locationId: selectedLocation,
          punchIn: punchIn.toISOString(),
        }),
      })
      if (res.status === 409) {
        Alert.alert('Already Clocked In', "You're already clocked in. Please clock out before starting a new shift.")
        return
      }
      if (res.ok) {
        const data: TimePunch = await res.json()
        setPunch(data)
        setBreakLog([{ event: 'clockIn', time: punchIn }])
      }
    } catch {
      // Network unavailable — fall back to local punch
      setPunch({
        id: `local-${Date.now()}`,
        punchIn: punchIn.toISOString(),
        locationId: selectedLocation,
      })
      setBreakLog([{ event: 'clockIn', time: punchIn }])
    } finally {
      setClockingIn(false)
    }
  }

  async function handleBreakToggle() {
    if (!punch) return

    // Validate custom input before starting break
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
      const body = onBreak
        ? { breakEnd: now.toISOString() }
        : { breakStart: now.toISOString() }
      const res = await fetch(`${API_BASE}/api/time-punches/${punch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await res.json()

      if (!onBreak) {
        setBreakLog((prev) => [...prev, { event: 'breakStart', time: now }])
        const mins = resolvedTimerMins()
        if (mins !== null) startMealTimer(mins, alertSound, alertVibrate)
      } else {
        setBreakLog((prev) => [...prev, { event: 'breakEnd', time: now }])
        stopMealTimer()
      }
      setOnBreak((prev) => !prev)
    } catch {
      // swallow
    } finally {
      setBreakLoading(false)
    }
  }

  async function handleClockOut() {
    if (!punch) return
    setClockingOut(true)

    stopMealTimer()
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    setPunch(null)
    setOnBreak(false)
    setBreakLog([])
    setTimerOption('none')
    setCustomInput('')
    setSelectedLocation(null)
    setClockingOut(false)

    if (!punch.id.startsWith('local-')) {
      try {
        await fetch(`${API_BASE}/api/time-punches/${punch.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ punchOut: new Date().toISOString() }),
        })
      } catch {
        // API unavailable
      }
    }
  }

  const activeLocation = locations.find((l) => l.id === punch?.locationId)
  const isCustomTimerInvalid =
    timerOption === 'custom' &&
    customInput.length > 0 &&
    (isNaN(parseInt(customInput, 10)) || parseInt(customInput, 10) <= 0)

  // ---- ACTIVE STATE ----
  if (punch) {
    return (
      <View style={styles.activeRoot}>
        {/* Teal header */}
        <SafeAreaView style={styles.activeTealSection} edges={['top']}>
          <Text style={styles.clockedInLabel}>Clocked in</Text>
          <Text style={styles.elapsedText}>{elapsed}</Text>
          <Text style={styles.activeSubtitle}>
            {activeLocation?.name ?? ''}
          </Text>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.activeScroll} keyboardShouldPersistTaps="handled">
          {/* Action card */}
          <View style={styles.activeCard}>
            {/* Meal timer section — only before break */}
            {!onBreak && (
              <View style={styles.timerSection}>
                <Text style={styles.timerSectionLabel}>Meal timer</Text>

                {/* Preset + Custom chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.timerChipRow}
                >
                  <TouchableOpacity
                    style={timerOption === 'none' ? styles.timerChipSelected : styles.timerChip}
                    onPress={() => setTimerOption('none')}
                  >
                    <Text style={timerOption === 'none' ? styles.timerChipTextSelected : styles.timerChipText}>
                      None
                    </Text>
                  </TouchableOpacity>

                  {PRESET_TIMER_MINS.map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={timerOption === mins ? styles.timerChipSelected : styles.timerChip}
                      onPress={() => setTimerOption(mins)}
                    >
                      <Text style={timerOption === mins ? styles.timerChipTextSelected : styles.timerChipText}>
                        {mins}m
                      </Text>
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={timerOption === 'custom' ? styles.timerChipSelected : styles.timerChip}
                    onPress={() => setTimerOption('custom')}
                  >
                    <Text style={timerOption === 'custom' ? styles.timerChipTextSelected : styles.timerChipText}>
                      Custom
                    </Text>
                  </TouchableOpacity>
                </ScrollView>

                {/* Custom minutes input */}
                {timerOption === 'custom' && (
                  <View style={styles.customInputRow}>
                    <TextInput
                      style={[styles.customInput, isCustomTimerInvalid && styles.customInputError]}
                      placeholder="Minutes"
                      placeholderTextColor="#bbb"
                      value={customInput}
                      onChangeText={setCustomInput}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <Text style={styles.customInputUnit}>min</Text>
                  </View>
                )}

                {/* Alert type toggles */}
                {timerOption !== 'none' && (
                  <View style={styles.alertToggleRow}>
                    <Text style={styles.alertToggleLabel}>Alert with</Text>
                    <TouchableOpacity
                      style={alertSound ? styles.alertChipSelected : styles.alertChip}
                      onPress={() => setAlertSound((v) => !v)}
                    >
                      <Text style={alertSound ? styles.alertChipTextSelected : styles.alertChipText}>
                        🔔 Sound
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={alertVibrate ? styles.alertChipSelected : styles.alertChip}
                      onPress={() => setAlertVibrate((v) => !v)}
                    >
                      <Text style={alertVibrate ? styles.alertChipTextSelected : styles.alertChipText}>
                        📳 Vibrate
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Break button */}
            <TouchableOpacity
              style={onBreak ? styles.breakBtnActive : styles.breakBtnIdle}
              onPress={handleBreakToggle}
              disabled={breakLoading}
            >
              {breakLoading ? (
                <ActivityIndicator color={onBreak ? '#fff' : '#D97706'} />
              ) : (
                <Text style={onBreak ? styles.breakBtnActiveText : styles.breakBtnIdleText}>
                  {onBreak ? 'End meal break' : 'Start meal break'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Countdown */}
            {onBreak && mealTimerRemaining !== null && (
              <View style={styles.countdownRow}>
                <View style={styles.countdownDot} />
                <Text style={styles.countdownText}>
                  Break ends in {formatCountdown(mealTimerRemaining)}
                </Text>
              </View>
            )}

            {/* Clock out */}
            <TouchableOpacity
              style={clockingOut ? styles.clockOutBtnDisabled : styles.clockOutBtn}
              onPress={handleClockOut}
              disabled={clockingOut}
            >
              {clockingOut ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.clockOutBtnText}>Clock out</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Time log */}
          <View style={styles.logCard}>
            <Text style={styles.logTitle}>Time Log</Text>
            {breakLog.map((entry, i) => (
              <View key={i} style={styles.logRow}>
                <View style={[styles.logDot, { backgroundColor: LOG_COLORS[entry.event] }]} />
                <Text style={styles.logTime}>{formatLogTime(entry.time)}</Text>
                <Text style={styles.logLabel}>{LOG_LABELS[entry.event]}</Text>
                {entry.event === 'clockIn' && punch.isTardy && (
                  <Text style={styles.tardyText}>Tardy</Text>
                )}
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
                <Text style={styles.logoMarkText}>B</Text>
              </View>
              <Text style={styles.brandName}>Brisa</Text>
            </View>
            {practiceName ? (
              <Text style={styles.practiceNameText}>{practiceName}</Text>
            ) : logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" />
            ) : null}
          </View>

          {/* Time + date */}
          <View style={styles.timeSection}>
            <Text style={styles.timeText}>{formatTime(now)}</Text>
            <Text style={styles.dateText}>{formatDate(now)}</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Location</Text>
            {locations.length === 0 ? (
              <ActivityIndicator color="#1D9E75" style={{ marginVertical: 8 }} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
                contentContainerStyle={styles.chipContent}
              >
                {locations.map((loc) => {
                  const selected = selectedLocation === loc.id
                  return (
                    <TouchableOpacity
                      key={loc.id}
                      style={selected ? styles.chipSelected : styles.chip}
                      onPress={() => setSelectedLocation(loc.id)}
                    >
                      <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                        {loc.name}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            )}

          </View>

          <TouchableOpacity
            style={[styles.clockInBtn, (!selectedLocation || clockingIn) && styles.clockInBtnDisabled]}
            onPress={handleClockIn}
            disabled={!selectedLocation || clockingIn}
          >
            {clockingIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.clockInBtnText}>Clock in</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <BottomNav />
    </View>
  )
}

const styles = StyleSheet.create({
  // --- Idle ---
  idleRoot: { flex: 1, backgroundColor: '#FAFAF8' },
  idleTopArea: { flex: 1 },
  idleScroll: { flexGrow: 1, paddingBottom: 24 },

  // Brisa brand header
  brandHeader: { alignItems: 'center', paddingTop: 32, paddingBottom: 12, gap: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D9E75',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoMarkText: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  brandName: { fontSize: 26, fontWeight: '800', color: '#2C2C2A', letterSpacing: -0.8 },
  logoImage: { width: 56, height: 56, borderRadius: 12 },
  practiceNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B6B68',
    letterSpacing: 0.1,
  },

  timeSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 20 },
  timeText: { fontSize: 44, fontWeight: '800', color: '#2C2C2A', letterSpacing: -1.5 },
  dateText: { fontSize: 14, color: '#6B6B68', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipScroll: { flexGrow: 0 },
  chipContent: { gap: 8, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipSelected: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1D9E75',
    borderWidth: 1,
    borderColor: '#1D9E75',
  },
  chipText: { fontSize: 13, color: '#444', fontWeight: '500' },
  chipTextSelected: { fontSize: 13, color: '#fff', fontWeight: '600' },
  clockInBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 18,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  clockInBtnDisabled: { backgroundColor: '#B0B0B0' },
  clockInBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // --- Active ---
  activeRoot: { flex: 1, backgroundColor: '#FAFAF8' },
  activeTealSection: {
    backgroundColor: '#1D9E75',
    paddingBottom: 32,
    alignItems: 'center',
    paddingTop: 48,
  },
  clockedInLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  elapsedText: { color: '#fff', fontSize: 48, fontWeight: '700', letterSpacing: -1 },
  activeSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 10 },
  tardyText: { fontSize: 12, color: '#DC2626', fontStyle: 'italic', marginLeft: 4 },
  activeScroll: { paddingTop: 16, paddingBottom: 40 },
  activeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 12,
  },

  // Meal timer section
  timerSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 16,
    gap: 10,
  },
  timerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerChipRow: { gap: 8, paddingRight: 4 },
  timerChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timerChipSelected: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#D97706',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  timerChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  timerChipTextSelected: { fontSize: 13, color: '#fff', fontWeight: '700' },

  customInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2A',
    backgroundColor: '#FAFAFA',
    width: 90,
    textAlign: 'center',
  },
  customInputError: { borderColor: '#EF4444' },
  customInputUnit: { fontSize: 14, color: '#888', fontWeight: '500' },

  alertToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertToggleLabel: { fontSize: 12, color: '#888', fontWeight: '500', marginRight: 4 },
  alertChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  alertChipSelected: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1D9E75',
    borderWidth: 1,
    borderColor: '#1D9E75',
  },
  alertChipText: { fontSize: 12, color: '#555', fontWeight: '500' },
  alertChipTextSelected: { fontSize: 12, color: '#fff', fontWeight: '600' },

  // Break buttons
  breakBtnIdle: {
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  breakBtnActive: {
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  breakBtnIdleText: { color: '#D97706', fontSize: 16, fontWeight: '600' },
  breakBtnActiveText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Countdown
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  countdownDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D97706' },
  countdownText: { fontSize: 15, fontWeight: '700', color: '#D97706' },

  // Clock out
  clockOutBtn: {
    backgroundColor: '#A32D2D',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  clockOutBtnDisabled: {
    backgroundColor: '#C97070',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  clockOutBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Time log
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  logTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logDot: { width: 10, height: 10, borderRadius: 5 },
  logTime: { fontSize: 13, fontWeight: '600', color: '#555', width: 80 },
  logLabel: { fontSize: 13, color: '#2C2C2A', flex: 1 },
})
