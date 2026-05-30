import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const PRACTICE_ID = 'replace-with-real-practice-id'
const USER_ID = 'replace-with-real-user-id'
const API_BASE = 'http://localhost:3000'

const TEST_LOCATIONS = [
  { id: 'test-loc-1', name: 'Main Office', address: '123 Dental Ave', city: 'New York', state: 'NY' },
  { id: 'test-loc-2', name: 'Uptown Branch', address: '456 Park Ave', city: 'New York', state: 'NY' },
]

const SPECIALTIES = [
  'General Dentistry',
  'Orthodontics',
  'Periodontics',
  'Endodontics',
  'Oral Surgery',
  'Hygiene',
  'Front Desk',
]

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
  return `${h.toString().padStart(2, '0')}:${m}:${s}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function HomeScreen() {
  // --- shared clock state ---
  const [now, setNow] = useState(new Date())

  // --- idle state ---
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null)
  const [clockingIn, setClockingIn] = useState(false)

  // --- active state ---
  const [punch, setPunch] = useState<TimePunch | null>(null)
  const [elapsed, setElapsed] = useState('00:00:00')
  const [onBreak, setOnBreak] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)
  const [breakLoading, setBreakLoading] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Wall clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch locations on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/locations?practiceId=${PRACTICE_ID}`)
      .then((r) => r.json())
      .then((data: Location[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setLocations(data)
        } else {
          setLocations(TEST_LOCATIONS)
        }
      })
      .catch(() => setLocations(TEST_LOCATIONS))
  }, [])

  // Elapsed timer while clocked in
  useEffect(() => {
    if (punch) {
      const punchInDate = new Date(punch.punchIn)
      setElapsed(formatElapsed(punchInDate))
      elapsedRef.current = setInterval(() => {
        setElapsed(formatElapsed(punchInDate))
      }, 1000)
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, [punch])

  async function handleClockIn() {
    if (!selectedLocation) return
    setClockingIn(true)

    const punchIn = new Date().toISOString()
    const localPunch: TimePunch = {
      id: `local-${Date.now()}`,
      punchIn,
      locationId: selectedLocation,
      specialty: selectedSpecialty ?? undefined,
    }

    // Show clocked-in state immediately
    setPunch(localPunch)
    setClockingIn(false)

    // Try to persist to API in background — update id if successful
    try {
      const res = await fetch(`${API_BASE}/api/time-punches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: PRACTICE_ID,
          userId: USER_ID,
          locationId: selectedLocation,
          specialty: selectedSpecialty ?? undefined,
          punchIn,
        }),
      })
      if (res.ok) {
        const data: TimePunch = await res.json()
        setPunch(data)
      }
    } catch {
      // API unavailable — local state is still shown
    }
  }

  async function handleBreakToggle() {
    if (!punch) return
    setBreakLoading(true)
    try {
      const body = onBreak
        ? { breakEnd: new Date().toISOString() }
        : { breakStart: new Date().toISOString() }
      const res = await fetch(`${API_BASE}/api/time-punches/${punch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await res.json()
      setOnBreak((prev) => !prev)
    } catch (e) {
      // swallow
    } finally {
      setBreakLoading(false)
    }
  }

  async function handleClockOut() {
    if (!punch) return
    setClockingOut(true)

    // Reset UI immediately
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    setPunch(null)
    setOnBreak(false)
    setSelectedLocation(null)
    setSelectedSpecialty(null)
    setClockingOut(false)

    // Try to persist to API in background
    if (!punch.id.startsWith('local-')) {
      try {
        await fetch(`${API_BASE}/api/time-punches/${punch.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ punchOut: new Date().toISOString() }),
        })
      } catch {
        // API unavailable — local state already reset
      }
    }
  }

  const activeLocation = locations.find((l) => l.id === punch?.locationId)

  // ---- ACTIVE STATE ----
  if (punch) {
    return (
      <View style={styles.activeRoot}>
        {/* Teal top half */}
        <SafeAreaView style={styles.activeTealSection} edges={['top']}>
          <Text style={styles.clockedInLabel}>Clocked in</Text>
          <Text style={styles.elapsedText}>{elapsed}</Text>
          <Text style={styles.activeSubtitle}>
            {activeLocation?.name ?? ''}
            {punch.specialty ? `  ·  ${punch.specialty}` : ''}
          </Text>
        </SafeAreaView>

        {/* White card */}
        <View style={styles.activeCard}>
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

          {/* Clock out button */}
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
      </View>
    )
  }

  // ---- IDLE STATE ----
  return (
    <SafeAreaView style={styles.idleRoot}>
      <ScrollView contentContainerStyle={styles.idleScroll} keyboardShouldPersistTaps="handled">
        {/* Time + date */}
        <View style={styles.timeSection}>
          <Text style={styles.timeText}>{formatTime(now)}</Text>
          <Text style={styles.dateText}>{formatDate(now)}</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Location picker */}
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

          {/* Specialty picker */}
          <Text style={[styles.cardLabel, { marginTop: 20 }]}>Specialty</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipContent}
          >
            {SPECIALTIES.map((spec) => {
              const selected = selectedSpecialty === spec
              return (
                <TouchableOpacity
                  key={spec}
                  style={selected ? styles.chipSelected : styles.chip}
                  onPress={() => setSelectedSpecialty(spec)}
                >
                  <Text style={selected ? styles.chipTextSelected : styles.chipText}>{spec}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        {/* Clock in button */}
        <TouchableOpacity
          style={[
            styles.clockInBtn,
            (!selectedLocation || clockingIn) && styles.clockInBtnDisabled,
          ]}
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
  )
}

const styles = StyleSheet.create({
  // --- Idle ---
  idleRoot: {
    flex: 1,
    backgroundColor: '#F1EFE8',
  },
  idleScroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  timeSection: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  timeText: {
    fontSize: 52,
    fontWeight: '700',
    color: '#2C2C2A',
    letterSpacing: -1,
  },
  dateText: {
    fontSize: 14,
    color: '#888',
    marginTop: 6,
  },
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
  chipScroll: {
    flexGrow: 0,
  },
  chipContent: {
    gap: 8,
    paddingRight: 4,
  },
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
  chipText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
  },
  chipTextSelected: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  noLocationsText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginVertical: 8,
  },
  clockInBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 18,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  clockInBtnDisabled: {
    backgroundColor: '#B0B0B0',
  },
  clockInBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // --- Active ---
  activeRoot: {
    flex: 1,
    backgroundColor: '#fff',
  },
  activeTealSection: {
    backgroundColor: '#1D9E75',
    paddingBottom: 60,
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
  elapsedText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  activeSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 10,
  },
  activeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginTop: -24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 16,
  },
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
  breakBtnIdleText: {
    color: '#D97706',
    fontSize: 16,
    fontWeight: '600',
  },
  breakBtnActiveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
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
  clockOutBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
})
