import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

const PRACTICE_ID = 'replace-with-real-practice-id'
const USER_ID = 'replace-with-real-user-id'
const API_BASE = 'http://localhost:3000'

const PTO_TYPES = ['vacation', 'sick', 'personal'] as const
type PtoType = (typeof PTO_TYPES)[number]

const TYPE_LABELS: Record<PtoType, string> = {
  vacation: 'Vacation',
  sick: 'Sick Day',
  personal: 'Personal',
}

const TYPE_COLORS: Record<PtoType, string> = {
  vacation: '#3B82F6',
  sick: '#F59E0B',
  personal: '#8B5CF6',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  approved: '#1D9E75',
  denied: '#EF4444',
}

interface Balance {
  total: number
  used: number
  remaining: number
}

interface Balances {
  vacation: Balance
  sick: Balance
  personal: Balance
}

interface PtoRequest {
  id: string
  startDate: string
  endDate: string
  type: string
  status: string
  notes: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))
}

export default function PtoScreen() {
  const [balances, setBalances] = useState<Balances | null>(null)
  const [myRequests, setMyRequests] = useState<PtoRequest[]>([])
  const [loadingBalance, setLoadingBalance] = useState(true)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedType, setSelectedType] = useState<PtoType>('vacation')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function fetchData() {
    setLoadingBalance(true)
    try {
      const [balRes, reqRes] = await Promise.all([
        fetch(`${API_BASE}/api/pto/balance?practiceId=${PRACTICE_ID}&userId=${USER_ID}`),
        fetch(`${API_BASE}/api/pto/requests?practiceId=${PRACTICE_ID}&userId=${USER_ID}`),
      ])
      const [bal, reqs] = await Promise.all([balRes.json(), reqRes.json()])
      if (bal && typeof bal === 'object' && 'vacation' in bal) setBalances(bal as Balances)
      if (Array.isArray(reqs)) setMyRequests(reqs)
    } catch {
      // silent — API may not be running
    } finally {
      setLoadingBalance(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  async function handleSubmit() {
    if (!isValidDate(startDate)) {
      Alert.alert('Invalid date', 'Start date must be in YYYY-MM-DD format.')
      return
    }
    if (!isValidDate(endDate)) {
      Alert.alert('Invalid date', 'End date must be in YYYY-MM-DD format.')
      return
    }
    if (endDate < startDate) {
      Alert.alert('Invalid dates', 'End date must be on or after start date.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/pto/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: PRACTICE_ID,
          userId: USER_ID,
          startDate,
          endDate,
          type: selectedType,
          notes: notes.trim() || undefined,
        }),
      })

      if (res.status === 409) {
        Alert.alert('Blocked', 'Your request overlaps with a blackout date. Please choose different dates.')
        return
      }
      if (!res.ok) throw new Error(await res.text())

      setStartDate('')
      setEndDate('')
      setNotes('')
      setSelectedType('vacation')
      Alert.alert('Submitted', 'Your time-off request has been submitted for approval.')
      await fetchData()
    } catch {
      Alert.alert('Error', 'Could not submit request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = isValidDate(startDate) && isValidDate(endDate) && endDate >= startDate && !submitting

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Time Off</Text>
          </View>

          {/* Balance cards */}
          <View style={styles.balanceRow}>
            {loadingBalance ? (
              <ActivityIndicator color="#1D9E75" style={{ flex: 1, marginVertical: 16 }} />
            ) : balances ? (
              (Object.entries(balances) as [PtoType, Balance][]).map(([type, bal]) => (
                <View key={type} style={[styles.balCard, { borderTopColor: TYPE_COLORS[type] }]}>
                  <Text style={[styles.balType, { color: TYPE_COLORS[type] }]}>
                    {TYPE_LABELS[type]}
                  </Text>
                  <Text style={styles.balRemaining}>{bal.remaining}</Text>
                  <Text style={styles.balSub}>days left</Text>
                  <Text style={styles.balDetail}>{bal.used}/{bal.total} used</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>Balance unavailable</Text>
            )}
          </View>

          {/* Request form */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>New Request</Text>

            {/* Type selector */}
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {PTO_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    selectedType === t && { backgroundColor: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] },
                  ]}
                  onPress={() => setSelectedType(t)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      selectedType === t && styles.typeChipTextSelected,
                    ]}
                  >
                    {TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Dates */}
            <Text style={[styles.label, { marginTop: 16 }]}>Start date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#aaa"
              value={startDate}
              onChangeText={setStartDate}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>End date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#aaa"
              value={endDate}
              onChangeText={setEndDate}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />

            {/* Notes */}
            <Text style={[styles.label, { marginTop: 12 }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Any details for your manager…"
              placeholderTextColor="#aaa"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* My requests */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>My Requests</Text>
            {myRequests.length === 0 ? (
              <Text style={styles.noDataText}>No requests yet.</Text>
            ) : (
              myRequests.map((req) => (
                <View key={req.id} style={styles.reqRow}>
                  <View style={styles.reqLeft}>
                    <View style={styles.reqTypeDot}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: TYPE_COLORS[req.type as PtoType] ?? '#999' },
                        ]}
                      />
                      <Text style={styles.reqTypeText}>{TYPE_LABELS[req.type as PtoType] ?? req.type}</Text>
                    </View>
                    <Text style={styles.reqDates}>
                      {formatDate(req.startDate)}
                      {req.startDate.split('T')[0] !== req.endDate.split('T')[0] &&
                        ` – ${formatDate(req.endDate)}`}
                    </Text>
                    {req.notes ? (
                      <Text style={styles.reqNotes} numberOfLines={1}>
                        {req.notes}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${STATUS_COLORS[req.status] ?? '#999'}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: STATUS_COLORS[req.status] ?? '#999' },
                      ]}
                    >
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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

  balanceRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginVertical: 16,
  },
  balCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    alignItems: 'center',
  },
  balType: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  balRemaining: { fontSize: 28, fontWeight: '800', color: '#2C2C2A' },
  balSub: { fontSize: 11, color: '#888', marginTop: 1 },
  balDetail: { fontSize: 10, color: '#bbb', marginTop: 4 },

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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2C2A',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },

  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  typeChipTextSelected: { color: '#fff' },

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

  submitBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnDisabled: { backgroundColor: '#B0B0B0' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  reqLeft: { flex: 1, marginRight: 12 },
  reqTypeDot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  reqTypeText: { fontSize: 13, fontWeight: '600', color: '#2C2C2A' },
  reqDates: { fontSize: 12, color: '#777' },
  reqNotes: { fontSize: 11, color: '#aaa', marginTop: 2 },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: '700' },

  noDataText: { fontSize: 13, color: '#aaa', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
})
