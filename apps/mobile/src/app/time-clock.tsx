import { useEffect, useLayoutEffect, useState } from 'react'
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
import { router } from 'expo-router'
import { markModuleSeen } from '../store/navBadgeStore'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const USER_ID = '165234da-d643-41e8-8ec8-6e400d18a1d2'
const API_BASE = 'http://192.168.0.137:3000'

const ADJUSTMENT_TYPES = [
  { key: 'missed_clock_in', label: 'Missed Clock-In' },
  { key: 'missed_clock_out', label: 'Missed Clock-Out' },
  { key: 'wrong_time', label: 'Wrong Time' },
  { key: 'other', label: 'Other' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: '#D97706',
  approved: '#1D9E75',
  denied: '#EF4444',
}

interface MyPunch {
  id: string
  punchIn: string
  punchOut: string | null
  location: { name: string }
  specialty: string | null
  isTardy: boolean
  breakStart: string | null
  breakEnd: string | null
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
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m} ${ampm}`
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

function formatUSDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function TimeClockScreen() {
  const [punches, setPunches] = useState<MyPunch[]>([])
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [loading, setLoading] = useState(true)

  const [modalVisible, setModalVisible] = useState(false)
  const [adjDate, setAdjDate] = useState('')
  const [adjPunchId, setAdjPunchId] = useState<string | undefined>()
  const [adjType, setAdjType] = useState('missed_clock_in')
  const [adjNotes, setAdjNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const weekStart = getMonday(new Date())
  const weekDays = getWeekDays(weekStart)

  useLayoutEffect(() => { markModuleSeen('timeClock') }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [pRes, aRes] = await Promise.all([
          fetch(`${API_BASE}/api/time-punches/mine?practiceId=${PRACTICE_ID}&userId=${USER_ID}&weekStart=${toISODate(weekStart)}`),
          fetch(`${API_BASE}/api/clock-adjustments?practiceId=${PRACTICE_ID}&userId=${USER_ID}`),
        ])
        const [pData, aData] = await Promise.all([pRes.json(), aRes.json()])
        if (Array.isArray(pData)) setPunches(pData)
        if (Array.isArray(aData)) setAdjustments(aData)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function openModal(date: Date, punchId?: string) {
    setAdjDate(toISODate(date))
    setAdjPunchId(punchId)
    setAdjType('missed_clock_in')
    setAdjNotes('')
    setModalVisible(true)
  }

  async function submitAdjustment() {
    if (!adjNotes.trim()) {
      Alert.alert('Notes required', 'Please describe the adjustment needed.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/clock-adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: PRACTICE_ID,
          userId: USER_ID,
          punchId: adjPunchId,
          date: adjDate,
          type: adjType,
          notes: adjNotes.trim(),
        }),
      })
      if (res.ok) {
        const data: Adjustment = await res.json()
        setAdjustments((prev) => [data, ...prev])
        setModalVisible(false)
        Alert.alert('Submitted', 'Your adjustment request has been sent to your manager.')
      } else {
        const err = await res.json().catch(() => ({}))
        Alert.alert('Could not submit', (err as { error?: string }).error ?? `Server error (${res.status}). Make sure the clock_adjustments table has been created in Supabase.`)
      }
    } catch (e) {
      Alert.alert('Connection error', 'Could not reach the server. Check that the API is running.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.topArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Time Clock</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Week label */}
          <Text style={styles.weekLabel}>
            Week of {formatDayHeader(weekStart)}
          </Text>

          {loading ? (
            <ActivityIndicator color="#1D9E75" style={{ marginTop: 40 }} />
          ) : (
            weekDays.map((day) => {
              const dayPunches = punches.filter((p) => isSameDay(p.punchIn, day))
              const isToday = isSameDay(new Date().toISOString(), day)

              return (
                <View key={day.toISOString()} style={styles.daySection}>
                  <View style={styles.dayHeader}>
                    <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                      {formatDayHeader(day)}
                      {isToday && <Text style={styles.todayTag}> · Today</Text>}
                    </Text>
                    <TouchableOpacity onPress={() => openModal(day)} style={styles.requestBtn}>
                      <Text style={styles.requestBtnText}>+ Request</Text>
                    </TouchableOpacity>
                  </View>

                  {dayPunches.length === 0 ? (
                    <Text style={styles.noPunches}>No punches recorded</Text>
                  ) : (
                    dayPunches.map((p) => (
                      <View key={p.id} style={styles.punchRow}>
                        <View style={styles.punchTimes}>
                          <Text style={styles.punchTime}>{formatTime(p.punchIn)}</Text>
                          <Text style={styles.punchArrow}>→</Text>
                          <Text style={styles.punchTime}>
                            {p.punchOut ? formatTime(p.punchOut) : '—'}
                          </Text>
                          {p.isTardy && <Text style={styles.tardyTag}>Tardy</Text>}
                        </View>
                        <View style={styles.punchMeta}>
                          <Text style={styles.punchDuration}>
                            {formatDuration(p.punchIn, p.punchOut, p.breakStart, p.breakEnd)}
                          </Text>
                          <Text style={styles.punchLocation}>{p.location.name}</Text>
                          <TouchableOpacity onPress={() => openModal(new Date(p.punchIn), p.id)}>
                            <Text style={styles.adjustLink}>Adjust</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )
            })
          )}

          {/* Past adjustment requests */}
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

      {/* Adjustment request modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <SafeAreaView style={styles.modalSheet} edges={['bottom']}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Request Adjustment</Text>
            <Text style={styles.modalDate}>{adjDate ? formatUSDate(adjDate) : ''}</Text>

            {/* Type selector */}
            <Text style={styles.fieldLabel}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeChips}>
              {ADJUSTMENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={adjType === t.key ? styles.typeChipSelected : styles.typeChip}
                  onPress={() => setAdjType(t.key)}
                >
                  <Text style={adjType === t.key ? styles.typeChipTextSelected : styles.typeChipText}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Notes */}
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Describe what needs to be corrected including the correct time…"
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={3}
              value={adjNotes}
              onChangeText={setAdjNotes}
            />

            <TouchableOpacity
              style={[styles.submitBtn, (submitting || !adjNotes.trim()) && styles.submitBtnDisabled]}
              onPress={submitAdjustment}
              disabled={submitting || !adjNotes.trim()}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1EFE8' },
  topArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  backBtn: { width: 70 },
  backText: { fontSize: 14, color: '#1D9E75', fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#2C2C2A' },
  headerRight: { width: 70 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  weekLabel: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },

  daySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  dayLabel: { fontSize: 13, fontWeight: '700', color: '#2C2C2A' },
  dayLabelToday: { color: '#1D9E75' },
  todayTag: { fontSize: 12, fontWeight: '500', color: '#1D9E75' },
  requestBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#E8F5F0' },
  requestBtnText: { fontSize: 12, fontWeight: '700', color: '#1D9E75' },
  noPunches: { fontSize: 13, color: '#bbb', padding: 16, fontStyle: 'italic' },

  punchRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F5F5F5',
    gap: 4,
  },
  punchTimes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  punchTime: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  punchArrow: { fontSize: 13, color: '#bbb' },
  tardyTag: { fontSize: 12, color: '#DC2626', fontStyle: 'italic', marginLeft: 4 },
  punchMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  punchDuration: { fontSize: 12, color: '#888', fontWeight: '500' },
  punchLocation: { fontSize: 12, color: '#aaa', flex: 1 },
  adjustLink: { fontSize: 12, color: '#1D9E75', fontWeight: '600' },

  adjSection: { marginTop: 8 },
  adjSectionTitle: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  adjRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  adjRowLeft: { gap: 2 },
  adjDate: { fontSize: 13, fontWeight: '600', color: '#2C2C2A' },
  adjType: { fontSize: 12, color: '#888' },
  adjStatus: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  adjStatusText: { fontSize: 12, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#2C2C2A' },
  modalDate: { fontSize: 13, color: '#888', marginTop: -8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  typeChips: { gap: 8, paddingBottom: 2 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0',
  },
  typeChipSelected: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1D9E75', borderWidth: 1, borderColor: '#1D9E75',
  },
  typeChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  typeChipTextSelected: { fontSize: 13, color: '#fff', fontWeight: '600' },
  notesInput: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#2C2C2A', backgroundColor: '#FAFAFA',
    minHeight: 80, textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#1D9E75', borderRadius: 10,
    paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 8,
  },
  submitBtnDisabled: { backgroundColor: '#B0B0B0' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
