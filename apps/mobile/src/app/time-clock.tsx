import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import BottomNav from '../components/BottomNav'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { markModuleSeen } from '../store/navBadgeStore'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

const ADJUSTMENT_TYPES = [
  { key: 'missed_clock_in',  label: 'Missed Clock-In'  },
  { key: 'missed_clock_out', label: 'Missed Clock-Out' },
  { key: 'begin_meal',       label: 'Begin Meal'       },
  { key: 'end_meal',         label: 'End Meal'         },
  { key: 'wrong_time',       label: 'Wrong Time'       },
  { key: 'other',            label: 'Other'            },
]

const STATUS_COLORS: Record<string, string> = {
  pending:  '#D97706',
  approved: '#1D9E75',
  denied:   '#EF4444',
}

interface ActivePunch {
  id: string
  punchIn: string
  locationId: string
  location: { name: string } | null
  specialty: string | null
  breakStart: string | null
  breakEnd:   string | null
  isTardy: boolean
}

interface MyPunch {
  id: string
  punchIn: string
  punchOut: string | null
  location: { name: string }
  specialty: string | null
  isTardy: boolean
  breakStart: string | null
  breakEnd:   string | null
}

interface Adjustment {
  id: string
  date: string
  type: string
  notes: string
  status: string
}

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function getWeekDays(mon: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`
}

function formatElapsed(punchIn: string): string {
  const secs = Math.floor((Date.now() - new Date(punchIn).getTime()) / 1000)
  const h = Math.floor(secs / 3600).toString().padStart(2, '0')
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatDuration(punchIn: string, punchOut: string | null, breakStart: string | null, breakEnd: string | null): string {
  if (!punchOut) return 'Active'
  let ms = new Date(punchOut).getTime() - new Date(punchIn).getTime()
  if (breakStart && breakEnd) ms -= new Date(breakEnd).getTime() - new Date(breakStart).getTime()
  if (ms < 0) ms = 0
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function isSameDay(iso: string, day: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

export default function TimeClockScreen() {
  const { user } = useAuth()
  const practiceId = user?.practiceId ?? ''
  const userId = user?.id ?? ''

  // Active punch
  const [activePunch, setActivePunch] = useState<ActivePunch | null>(null)
  const [onBreak, setOnBreak] = useState(false)
  const [elapsed, setElapsed] = useState('00:00:00')
  const [breakLoading, setBreakLoading] = useState(false)
  const [clockOutLoading, setClockOutLoading] = useState(false)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Weekly history
  const [punches, setPunches] = useState<MyPunch[]>([])
  const [absentDates, setAbsentDates] = useState<string[]>([])
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [loading, setLoading] = useState(true)

  const weekStart = getMonday(new Date())
  const weekDays = getWeekDays(weekStart)

  useLayoutEffect(() => { markModuleSeen('timeClock') }, [])

  // Elapsed ticker
  useEffect(() => {
    if (activePunch) {
      setElapsed(formatElapsed(activePunch.punchIn))
      elapsedRef.current = setInterval(() => setElapsed(formatElapsed(activePunch.punchIn)), 1000)
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current) }
  }, [activePunch])

  useFocusEffect(useCallback(() => {
    if (practiceId && userId) {
      loadActivePunch()
      loadHistory()
    }
  }, [practiceId, userId]))

  async function loadActivePunch() {
    try {
      const res = await apiFetch(`/api/time-punches/live?practiceId=${practiceId}`)
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data)) return
      const active = data.find((p: { userId: string }) => p.userId === userId)
      if (active) {
        setActivePunch(active)
        setOnBreak(!!(active.breakStart && !active.breakEnd))
      } else {
        setActivePunch(null)
        setOnBreak(false)
      }
    } catch { /* silent */ }
  }

  async function loadHistory() {
    setLoading(true)
    try {
      const [pRes, aRes] = await Promise.all([
        apiFetch(`/api/time-punches/mine?practiceId=${practiceId}&userId=${userId}&weekStart=${toISODate(weekStart)}`),
        apiFetch(`/api/clock-adjustments?practiceId=${practiceId}&userId=${userId}`),
      ])
      const [pData, aData] = await Promise.all([pRes.json(), aRes.json()])
      if (pData?.punches && Array.isArray(pData.punches)) {
        setPunches(pData.punches)
        setAbsentDates(pData.absentDates ?? [])
      } else if (Array.isArray(pData)) {
        setPunches(pData)
      }
      if (Array.isArray(aData)) setAdjustments(aData)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  async function handleBeginMeal() {
    if (!activePunch || onBreak) return
    setBreakLoading(true)
    try {
      const n = new Date()
      await apiFetch(`/api/time-punches/${activePunch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ breakStart: n.toISOString() }),
      })
      setActivePunch(prev => prev ? { ...prev, breakStart: n.toISOString(), breakEnd: null } : prev)
      setOnBreak(true)
    } catch { /* silent */ }
    finally { setBreakLoading(false) }
  }

  async function handleEndMeal() {
    if (!activePunch || !onBreak) return
    setBreakLoading(true)
    try {
      const n = new Date()
      await apiFetch(`/api/time-punches/${activePunch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ breakEnd: n.toISOString() }),
      })
      setActivePunch(prev => prev ? { ...prev, breakEnd: n.toISOString() } : prev)
      setOnBreak(false)
    } catch { /* silent */ }
    finally { setBreakLoading(false) }
  }

  async function handleClockOut() {
    if (!activePunch) return
    setClockOutLoading(true)
    const id = activePunch.id
    setActivePunch(null)
    setOnBreak(false)
    try {
      await apiFetch(`/api/time-punches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ punchOut: new Date().toISOString() }),
      })
      await loadHistory()
    } catch { /* silent */ }
    finally { setClockOutLoading(false) }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.topArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Time Clock</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>

          {/* Active punch card */}
          {activePunch ? (
            <View style={styles.activeCard}>
              <View style={styles.activeCardTop}>
                <View style={styles.activeDot} />
                <Text style={styles.activeLabel}>CLOCKED IN</Text>
                <Text style={styles.activeElapsed}>{elapsed}</Text>
              </View>
              {activePunch.location && (
                <Text style={styles.activeLocation}>{activePunch.location.name}</Text>
              )}
              {onBreak && (
                <View style={styles.breakBadge}>
                  <Text style={styles.breakBadgeText}>On meal break</Text>
                </View>
              )}
              <View style={styles.punchActionRow}>
                <TouchableOpacity
                  style={[styles.mealBtn, onBreak && styles.mealBtnOff]}
                  onPress={handleBeginMeal}
                  disabled={onBreak || breakLoading}
                >
                  {breakLoading && !onBreak
                    ? <ActivityIndicator color="#D97706" size="small" />
                    : <Text style={[styles.mealBtnText, onBreak && styles.mealBtnTextOff]}>Begin Meal</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mealBtn, !onBreak && styles.mealBtnOff]}
                  onPress={handleEndMeal}
                  disabled={!onBreak || breakLoading}
                >
                  {breakLoading && onBreak
                    ? <ActivityIndicator color="#D97706" size="small" />
                    : <Text style={[styles.mealBtnText, !onBreak && styles.mealBtnTextOff]}>End Meal</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.clockOutBtn, clockOutLoading && { opacity: 0.6 }]}
                  onPress={handleClockOut}
                  disabled={clockOutLoading}
                >
                  {clockOutLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.clockOutBtnText}>Clock Out</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.notClockedCard}>
              <Text style={styles.notClockedText}>Not clocked in</Text>
              <Text style={styles.notClockedSub}>Use the home screen to clock in</Text>
            </View>
          )}

          {/* Week label */}
          <Text style={styles.weekLabel}>Week of {formatDayHeader(weekStart)}</Text>

          {loading ? (
            <ActivityIndicator color="#1D9E75" style={{ marginTop: 24 }} />
          ) : (
            weekDays.map((day) => {
              const dayPunches = punches.filter((p) => isSameDay(p.punchIn, day))
              const isToday = isSameDay(new Date().toISOString(), day)

              return (
                <View key={day.toISOString()} style={styles.daySection}>
                  <View style={styles.dayHeader}>
                    <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                      {formatDayHeader(day)}{isToday ? '  · Today' : ''}
                    </Text>
                  </View>

                  {dayPunches.length === 0 ? (
                    (() => {
                      const iso = toISODate(day)
                      const today = new Date(); today.setHours(0, 0, 0, 0)
                      const isAbsent = day < today && absentDates.includes(iso)
                      return (
                        <Text style={isAbsent ? styles.absentText : styles.noPunches}>
                          {isAbsent ? 'Absent' : 'No punches recorded'}
                        </Text>
                      )
                    })()
                  ) : (
                    dayPunches.map((p) => (
                      <View key={p.id} style={styles.punchRow}>
                        <View style={styles.punchTimes}>
                          <Text style={styles.punchTime}>{formatTime(p.punchIn)}</Text>
                          <Text style={styles.punchArrow}>→</Text>
                          <Text style={styles.punchTime}>{p.punchOut ? formatTime(p.punchOut) : '—'}</Text>
                          {p.isTardy && <Text style={styles.tardyTag}>Tardy</Text>}
                        </View>
                        <View style={styles.punchMeta}>
                          <Text style={styles.punchDuration}>{formatDuration(p.punchIn, p.punchOut, p.breakStart, p.breakEnd)}</Text>
                          <Text style={styles.punchLocation}>{p.location.name}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )
            })
          )}

          {/* Past adjustments */}
          {adjustments.length > 0 && (
            <View style={styles.adjSection}>
              <Text style={styles.adjSectionTitle}>My Adjustment Requests</Text>
              {adjustments.slice(0, 5).map((a) => (
                <View key={a.id} style={styles.adjRow}>
                  <View style={styles.adjRowLeft}>
                    <Text style={styles.adjDate}>{new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                    <Text style={styles.adjType}>{ADJUSTMENT_TYPES.find((t) => t.key === a.type)?.label ?? a.type}</Text>
                  </View>
                  <View style={[styles.adjStatus, { backgroundColor: (STATUS_COLORS[a.status] ?? '#888') + '20' }]}>
                    <Text style={[styles.adjStatusText, { color: STATUS_COLORS[a.status] ?? '#888' }]}>
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <BottomNav activeRoute="time-clock" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1EFE8' },
  topArea: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#2C3E3A' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FAF6EF' },

  // Active punch card
  activeCard: { backgroundColor: '#1D9E75', borderRadius: 16, padding: 20, marginBottom: 20, gap: 12 },
  activeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  activeLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 2, flex: 1 },
  activeElapsed: { fontSize: 22, fontWeight: '200', color: '#fff', letterSpacing: 2 },
  activeLocation: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '400' },
  breakBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  breakBadgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  punchActionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  mealBtn: { flex: 1, borderWidth: 1.5, borderColor: '#fff', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  mealBtnOff: { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.05)' },
  mealBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mealBtnTextOff: { color: 'rgba(255,255,255,0.35)' },
  clockOutBtn: { flex: 1, backgroundColor: '#A32D2D', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  clockOutBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Not clocked in
  notClockedCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 20, alignItems: 'center', gap: 4 },
  notClockedText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  notClockedSub: { fontSize: 13, color: '#9CA3AF' },

  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  weekLabel: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  daySection: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0' },
  dayLabel: { fontSize: 13, fontWeight: '700', color: '#2C2C2A' },
  dayLabelToday: { color: '#1D9E75' },
  noPunches: { fontSize: 13, color: '#bbb', padding: 16, fontStyle: 'italic' },
  absentText: { fontSize: 13, color: '#DC2626', padding: 16, fontStyle: 'italic', fontWeight: '600' },

  punchRow: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F5F5F5', gap: 4 },
  punchTimes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  punchTime: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  punchArrow: { fontSize: 13, color: '#bbb' },
  tardyTag: { fontSize: 12, color: '#DC2626', fontStyle: 'italic', marginLeft: 4 },
  punchMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  punchDuration: { fontSize: 12, color: '#888', fontWeight: '500' },
  punchLocation: { fontSize: 12, color: '#aaa', flex: 1 },

  adjSection: { marginTop: 8 },
  adjSectionTitle: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  adjRow: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  adjRowLeft: { gap: 2 },
  adjDate: { fontSize: 13, fontWeight: '600', color: '#2C2C2A' },
  adjType: { fontSize: 12, color: '#888' },
  adjStatus: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  adjStatusText: { fontSize: 12, fontWeight: '600' },
})
