import { useLayoutEffect, useState } from 'react'
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
import { router } from 'expo-router'
import { markModuleSeen } from '../store/navBadgeStore'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const USER_ID = '165234da-d643-41e8-8ec8-6e400d18a1d2' // Daniel Quiroga (staff)
const API_BASE = 'http://192.168.0.137:3000'

// ── Time-off types ──────────────────────────────────────────────────────────
type TimeOffType = 'pto' | 'unpaid'

const TIME_OFF_TYPES: TimeOffType[] = ['pto', 'unpaid']

const TIME_OFF_LABELS: Record<TimeOffType, string> = {
  pto: 'PTO',
  unpaid: 'Unpaid',
}

const TIME_OFF_COLORS: Record<TimeOffType, string> = {
  pto: '#1D9E75',
  unpaid: '#6B7280',
}

// ── Shared lookup for My Requests list ──────────────────────────────────────
const ALL_TYPE_LABELS: Record<string, string> = {
  pto: 'PTO',
  unpaid: 'Unpaid',
  schedule_adjustment: 'Schedule Adjustment',
  vacation: 'Vacation',
  sick: 'Sick Day',
  personal: 'Personal',
  late_arrival: 'Late Arrival',
  early_departure: 'Early Departure',
  long_lunch: 'Long Lunch',
}

const ALL_TYPE_COLORS: Record<string, string> = {
  pto: '#1D9E75',
  unpaid: '#6B7280',
  schedule_adjustment: '#4F46E5',
  vacation: '#3B82F6',
  sick: '#F59E0B',
  personal: '#8B5CF6',
  late_arrival: '#3B82F6',
  early_departure: '#F59E0B',
  long_lunch: '#8B5CF6',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  approved: '#1D9E75',
  denied: '#EF4444',
}

const SCHEDULE_TYPES = new Set<string>([
  'schedule_adjustment', 'late_arrival', 'early_departure', 'long_lunch',
])

// ── Data types ──────────────────────────────────────────────────────────────
interface PtoBalance {
  total: number
  used: number
  remaining: number
}

interface ApiBalances {
  vacation?: PtoBalance
  [key: string]: PtoBalance | undefined
}

interface Request {
  id: string
  startDate: string
  endDate: string
  type: string
  status: string
  notes: string | null
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function toUSDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

function parseUSDate(s: string): Date {
  const [m, d, y] = s.split('/').map(Number)
  return new Date(y, m - 1, d)
}

function isValidUSDate(s: string): boolean {
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return false
  const [m, d, y] = s.split('/').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function usDateToISO(s: string): string {
  const [m, d, y] = s.split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

// ── DateInput component ──────────────────────────────────────────────────────
function DateInput({
  label,
  value,
  onChange,
  topSpacing = true,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  topSpacing?: boolean
}) {
  const [show, setShow] = useState(false)
  // Draft only used on iOS — committed on Done
  const [draft, setDraft] = useState<Date>(new Date())

  const current = isValidUSDate(value) ? parseUSDate(value) : new Date()

  function openPicker() {
    setDraft(current)
    setShow(true)
  }

  function handleAndroidChange(_: DateTimePickerEvent, date?: Date) {
    setShow(false)
    if (date) onChange(toUSDate(date))
  }

  function handleIOSChange(_: DateTimePickerEvent, date?: Date) {
    if (date) setDraft(date)
  }

  function commitIOS() {
    onChange(toUSDate(draft))
    setShow(false)
  }

  return (
    <View style={topSpacing ? styles.dateFieldSpacing : undefined}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dateBtn} onPress={openPicker} activeOpacity={0.7}>
        <Text style={value ? styles.dateBtnText : styles.dateBtnPlaceholder}>
          {value || 'Select date'}
        </Text>
        <Text style={styles.calIcon}>📅</Text>
      </TouchableOpacity>

      {/* Android: renders as a native dialog automatically */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={current}
          mode="date"
          display="calendar"
          onChange={handleAndroidChange}
        />
      )}

      {/* iOS: slide-up modal with spinner + Done/Cancel */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShow(false)} style={styles.modalHeaderBtn}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{label}</Text>
                <TouchableOpacity onPress={commitIOS} style={styles.modalHeaderBtn}>
                  <Text style={styles.modalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                onChange={handleIOSChange}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TimeOffScreen() {
  const [ptoBalance, setPtoBalance] = useState<PtoBalance | null>(null)
  const [myRequests, setMyRequests] = useState<Request[]>([])
  const [loadingBalance, setLoadingBalance] = useState(true)

  // Time-off form
  const [timeOffType, setTimeOffType] = useState<TimeOffType>('pto')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [timeOffNotes, setTimeOffNotes] = useState('')
  const [submittingTimeOff, setSubmittingTimeOff] = useState(false)

  // Schedule adjustment form
  const [adjustmentDate, setAdjustmentDate] = useState('')
  const [adjustmentDescription, setAdjustmentDescription] = useState('')
  const [adjustmentNotes, setAdjustmentNotes] = useState('')
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false)

  async function fetchData() {
    setLoadingBalance(true)
    try {
      const [balRes, reqRes] = await Promise.all([
        fetch(`${API_BASE}/api/pto/balance?practiceId=${PRACTICE_ID}&userId=${USER_ID}`),
        fetch(`${API_BASE}/api/pto/requests?practiceId=${PRACTICE_ID}&userId=${USER_ID}`),
      ])
      const [bal, reqs] = await Promise.all([balRes.json(), reqRes.json()])
      const balData = bal as ApiBalances
      if (balData?.vacation) setPtoBalance(balData.vacation)
      if (Array.isArray(reqs)) setMyRequests(reqs)
    } catch {
      // silent — API may not be running during testing
    } finally {
      setLoadingBalance(false)
    }
  }

  useLayoutEffect(() => { markModuleSeen('timeOff') }, [])

  useState(() => { fetchData() })

  async function handleTimeOffSubmit() {
    if (!isValidUSDate(startDate)) {
      Alert.alert('Select start date', 'Please select a start date.')
      return
    }
    if (!isValidUSDate(endDate)) {
      Alert.alert('Select end date', 'Please select an end date.')
      return
    }
    const isoStart = usDateToISO(startDate)
    const isoEnd = usDateToISO(endDate)
    if (isoEnd < isoStart) {
      Alert.alert('Invalid dates', 'End date must be on or after start date.')
      return
    }

    setSubmittingTimeOff(true)
    try {
      const res = await fetch(`${API_BASE}/api/pto/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: PRACTICE_ID,
          userId: USER_ID,
          startDate: isoStart,
          endDate: isoEnd,
          type: timeOffType,
          notes: timeOffNotes.trim() || undefined,
        }),
      })

      if (res.status === 409) {
        Alert.alert('Blocked', 'Your request overlaps with a blackout date. Please choose different dates.')
        return
      }
      if (!res.ok) throw new Error(await res.text())

      setStartDate('')
      setEndDate('')
      setTimeOffNotes('')
      Alert.alert('Submitted', 'Your time-off request has been submitted for approval.')
      await fetchData()
    } catch {
      Alert.alert('Error', 'Could not submit request. Please try again.')
    } finally {
      setSubmittingTimeOff(false)
    }
  }

  async function handleAdjustmentSubmit() {
    if (!isValidUSDate(adjustmentDate)) {
      Alert.alert('Select date', 'Please select a date for the adjustment.')
      return
    }
    if (!adjustmentDescription.trim()) {
      Alert.alert('Missing description', 'Please describe the schedule adjustment.')
      return
    }

    setSubmittingAdjustment(true)
    try {
      const isoDate = usDateToISO(adjustmentDate)
      const fullNotes = adjustmentNotes.trim()
        ? `${adjustmentDescription.trim()} — ${adjustmentNotes.trim()}`
        : adjustmentDescription.trim()

      const res = await fetch(`${API_BASE}/api/pto/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: PRACTICE_ID,
          userId: USER_ID,
          startDate: isoDate,
          endDate: isoDate,
          type: 'schedule_adjustment',
          notes: fullNotes,
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      setAdjustmentDate('')
      setAdjustmentDescription('')
      setAdjustmentNotes('')
      Alert.alert('Submitted', 'Your schedule adjustment has been submitted for approval.')
      await fetchData()
    } catch {
      Alert.alert('Error', 'Could not submit request. Please try again.')
    } finally {
      setSubmittingAdjustment(false)
    }
  }

  const canSubmitTimeOff =
    isValidUSDate(startDate) && isValidUSDate(endDate) &&
    usDateToISO(endDate) >= usDateToISO(startDate) && !submittingTimeOff

  const canSubmitAdjustment =
    isValidUSDate(adjustmentDate) && adjustmentDescription.trim().length > 0 && !submittingAdjustment

  return (
    <View style={styles.root}>
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Time Off</Text>
          </View>

          {/* PTO Balance */}
          <View style={styles.balanceSection}>
            {loadingBalance ? (
              <ActivityIndicator color="#1D9E75" style={{ marginVertical: 16 }} />
            ) : ptoBalance ? (
              <View style={styles.balCard}>
                <View style={styles.balLeft}>
                  <Text style={styles.balLabel}>PTO Balance</Text>
                  <Text style={styles.balDetail}>{ptoBalance.used} of {ptoBalance.total} days used</Text>
                </View>
                <View style={styles.balRight}>
                  <Text style={styles.balRemaining}>{ptoBalance.remaining}</Text>
                  <Text style={styles.balSub}>days left</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noDataText}>Balance unavailable</Text>
            )}
          </View>

          {/* ── Time Off Request ─────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Time Off Request</Text>

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {TIME_OFF_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    timeOffType === t && { backgroundColor: TIME_OFF_COLORS[t], borderColor: TIME_OFF_COLORS[t] },
                  ]}
                  onPress={() => setTimeOffType(t)}
                >
                  <Text style={[styles.typeChipText, timeOffType === t && styles.typeChipTextSelected]}>
                    {TIME_OFF_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <DateInput label="Start date" value={startDate} onChange={setStartDate} />
            <DateInput label="End date" value={endDate} onChange={setEndDate} />

            <Text style={[styles.label, styles.topSpacing]}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Any details for your manager…"
              placeholderTextColor="#aaa"
              value={timeOffNotes}
              onChangeText={setTimeOffNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmitTimeOff && styles.submitBtnDisabled]}
              onPress={handleTimeOffSubmit}
              disabled={!canSubmitTimeOff}
            >
              {submittingTimeOff ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Schedule Adjustment ──────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Schedule Adjustment</Text>
            <Text style={styles.cardSubtitle}>For days when your schedule differs from normal</Text>

            <Text style={[styles.label, { marginTop: 4 }]}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Late arrival, early departure, extended lunch…"
              placeholderTextColor="#aaa"
              value={adjustmentDescription}
              onChangeText={setAdjustmentDescription}
            />

            <DateInput label="Date" value={adjustmentDate} onChange={setAdjustmentDate} />

            <Text style={[styles.label, styles.topSpacing]}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Any details for your manager…"
              placeholderTextColor="#aaa"
              value={adjustmentNotes}
              onChangeText={setAdjustmentNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, styles.submitBtnAdjust, !canSubmitAdjustment && styles.submitBtnDisabled]}
              onPress={handleAdjustmentSubmit}
              disabled={!canSubmitAdjustment}
            >
              {submittingAdjustment ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Adjustment</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── My Requests ──────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>My Requests</Text>
            {myRequests.length === 0 ? (
              <Text style={styles.noDataText}>No requests yet.</Text>
            ) : (
              myRequests.map((req) => {
                const color = ALL_TYPE_COLORS[req.type] ?? '#999'
                const label = ALL_TYPE_LABELS[req.type] ?? req.type
                const isSchedule = SCHEDULE_TYPES.has(req.type)
                const sameDay = req.startDate.split('T')[0] === req.endDate.split('T')[0]

                return (
                  <View key={req.id} style={styles.reqRow}>
                    <View style={styles.reqLeft}>
                      <View style={styles.reqTypeRow}>
                        <View style={[styles.dot, { backgroundColor: color }]} />
                        <Text style={styles.reqTypeText}>{label}</Text>
                        {isSchedule && (
                          <View style={[styles.schedBadge, { backgroundColor: `${color}18` }]}>
                            <Text style={[styles.schedBadgeText, { color }]}>Schedule</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.reqDates}>
                        {isSchedule || sameDay
                          ? formatDisplayDate(req.startDate)
                          : `${formatDisplayDate(req.startDate)} – ${formatDisplayDate(req.endDate)}`}
                      </Text>
                      {req.notes ? (
                        <Text style={styles.reqNotes} numberOfLines={2}>{req.notes}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[req.status] ?? '#999'}20` }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[req.status] ?? '#999' }]}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                )
              })
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
      <BottomNav activeRoute="pto" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1EFE8' },
  scroll: { paddingBottom: 48 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 14, color: '#1D9E75', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: '#2C2C2A' },

  // Balance
  balanceSection: { paddingHorizontal: 20, marginBottom: 16, marginTop: 8 },
  balCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: '#1D9E75',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  balLeft: { gap: 4 },
  balLabel: { fontSize: 13, fontWeight: '700', color: '#1D9E75', textTransform: 'uppercase', letterSpacing: 0.5 },
  balDetail: { fontSize: 12, color: '#888' },
  balRight: { alignItems: 'flex-end' },
  balRemaining: { fontSize: 32, fontWeight: '800', color: '#2C2C2A', lineHeight: 36 },
  balSub: { fontSize: 12, color: '#888' },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#2C2C2A', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: '#999', marginBottom: 16 },

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  topSpacing: { marginTop: 16 },

  // Type chips
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  typeChipTextSelected: { color: '#fff' },

  // Date button
  dateFieldSpacing: { marginTop: 16 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  dateBtnText: { fontSize: 14, color: '#2C2C2A', fontWeight: '500' },
  dateBtnPlaceholder: { fontSize: 14, color: '#bbb' },
  calIcon: { fontSize: 18 },

  // iOS date picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalHeaderBtn: { minWidth: 56 },
  modalTitle: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#1D9E75', textAlign: 'right' },
  iosPicker: { height: 200 },

  // Text inputs
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#2C2C2A',
    backgroundColor: '#FAFAFA',
  },
  notesInput: { height: 72, paddingTop: 10 },

  // Submit buttons
  submitBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnAdjust: { backgroundColor: '#4F46E5' },
  submitBtnDisabled: { backgroundColor: '#B0B0B0' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Requests list
  reqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  reqLeft: { flex: 1, marginRight: 12, gap: 3 },
  reqTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  reqTypeText: { fontSize: 13, fontWeight: '600', color: '#2C2C2A' },
  schedBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  schedBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  reqDates: { fontSize: 12, color: '#777' },
  reqNotes: { fontSize: 11, color: '#aaa' },
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  statusText: { fontSize: 12, fontWeight: '700' },

  noDataText: { fontSize: 13, color: '#aaa', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
})
