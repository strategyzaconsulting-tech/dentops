import { useEffect, useLayoutEffect, useState } from 'react'
import BottomNav from '../components/BottomNav'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { markModuleSeen } from '../store/navBadgeStore'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const USER_ID = '165234da-d643-41e8-8ec8-6e400d18a1d2'
const API_BASE = 'http://192.168.0.137:3000'

const CLAIM_STATUS_COLORS: Record<string, string> = {
  pending: '#D97706',
  approved: '#1D9E75',
  denied: '#EF4444',
}

interface OpenShift {
  id: string
  location: { name: string }
  date: string
  startTime: string
  endTime: string
  specialty: string | null
  notes: string | null
  status: string
  claims: { userId: string; status: string }[]
}

interface MyClaim {
  id: string
  status: string
  openShift: {
    date: string
    startTime: string
    endTime: string
    location: { name: string }
    specialty: string | null
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime12h(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function OpenShiftsScreen() {
  const [shifts, setShifts] = useState<OpenShift[]>([])
  const [myClaims, setMyClaims] = useState<MyClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  useLayoutEffect(() => { markModuleSeen('openShifts') }, [])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [sRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/api/open-shifts?practiceId=${PRACTICE_ID}&status=open`),
        fetch(`${API_BASE}/api/open-shifts/claims?practiceId=${PRACTICE_ID}&userId=${USER_ID}`),
      ])
      const [sData, cData] = await Promise.all([sRes.json(), cRes.json()])
      if (Array.isArray(sData)) setShifts(sData)
      if (Array.isArray(cData)) setMyClaims(cData)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  async function claimShift(shiftId: string) {
    setClaimingId(shiftId)
    try {
      const res = await fetch(`${API_BASE}/api/open-shifts/${shiftId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: PRACTICE_ID, userId: USER_ID }),
      })
      if (res.ok) {
        Alert.alert('Claimed!', 'Your request has been sent to your manager for approval.')
        await load()
      } else if (res.status === 409) {
        Alert.alert('Already claimed', 'You have already claimed this shift.')
      } else {
        Alert.alert('Error', 'Could not claim this shift. Please try again.')
      }
    } catch {
      Alert.alert('Connection error', 'Could not reach the server.')
    } finally {
      setClaimingId(null)
    }
  }

  const claimedShiftIds = new Set(myClaims.map((c) => c.openShift && c.status !== 'denied' ? c.openShiftId ?? '' : ''))

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.topArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Open Shifts</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {loading ? (
            <ActivityIndicator color="#1D9E75" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Available shifts */}
              <Text style={styles.sectionTitle}>Available</Text>
              {shifts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No open shifts right now</Text>
                </View>
              ) : (
                shifts.map((shift) => {
                  const alreadyClaimed = myClaims.some(
                    (c) => c.openShift && c.status !== 'denied'
                  )
                  const myClaimForThis = myClaims.find(
                    (c) => {
                      const id = (c as MyClaim & { openShiftId?: string }).openShiftId
                      return id === shift.id
                    }
                  )

                  return (
                    <View key={shift.id} style={styles.shiftCard}>
                      <View style={styles.shiftTop}>
                        <View style={styles.shiftInfo}>
                          <Text style={styles.shiftDate}>{formatDate(shift.date)}</Text>
                          <Text style={styles.shiftTime}>{formatTime12h(shift.startTime)} – {formatTime12h(shift.endTime)}</Text>
                          <Text style={styles.shiftLocation}>{shift.location.name}</Text>
                          {shift.specialty && <Text style={styles.shiftSpecialty}>{shift.specialty}</Text>}
                          {shift.notes && <Text style={styles.shiftNotes}>{shift.notes}</Text>}
                        </View>

                        {myClaimForThis ? (
                          <View style={[styles.claimBadge, { backgroundColor: (CLAIM_STATUS_COLORS[myClaimForThis.status] ?? '#888') + '20' }]}>
                            <Text style={[styles.claimBadgeText, { color: CLAIM_STATUS_COLORS[myClaimForThis.status] ?? '#888' }]}>
                              {myClaimForThis.status.charAt(0).toUpperCase() + myClaimForThis.status.slice(1)}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.claimBtn, claimingId === shift.id && styles.claimBtnDisabled]}
                            onPress={() => claimShift(shift.id)}
                            disabled={claimingId === shift.id}
                          >
                            {claimingId === shift.id ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Text style={styles.claimBtnText}>Claim</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )
                })
              )}

              {/* My claims */}
              {myClaims.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 24 }]}>My Claims</Text>
                  {myClaims.map((claim) => (
                    <View key={claim.id} style={styles.claimRow}>
                      <View style={styles.claimRowLeft}>
                        <Text style={styles.claimRowDate}>{formatDate(claim.openShift.date)}</Text>
                        <Text style={styles.claimRowTime}>{formatTime12h(claim.openShift.startTime)} – {formatTime12h(claim.openShift.endTime)}</Text>
                        <Text style={styles.claimRowLocation}>{claim.openShift.location.name}</Text>
                      </View>
                      <View style={[styles.claimBadge, { backgroundColor: (CLAIM_STATUS_COLORS[claim.status] ?? '#888') + '20' }]}>
                        <Text style={[styles.claimBadgeText, { color: CLAIM_STATUS_COLORS[claim.status] ?? '#888' }]}>
                          {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      <BottomNav activeRoute="open-shifts" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1EFE8' },
  topArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0E0E0',
  },
  backBtn: { width: 70 },
  backText: { fontSize: 14, color: '#1D9E75', fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#2C2C2A' },
  headerRight: { width: 70 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 32, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  emptyText: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
  shiftCard: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  shiftTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  shiftInfo: { flex: 1, gap: 2 },
  shiftDate: { fontSize: 14, fontWeight: '700', color: '#2C2C2A' },
  shiftTime: { fontSize: 13, color: '#555' },
  shiftLocation: { fontSize: 12, color: '#888' },
  shiftSpecialty: {
    fontSize: 11, fontWeight: '600', color: '#1D9E75',
    marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  shiftNotes: { fontSize: 12, color: '#aaa', fontStyle: 'italic', marginTop: 4 },
  claimBtn: {
    backgroundColor: '#1D9E75', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8, marginLeft: 12,
  },
  claimBtnDisabled: { backgroundColor: '#B0B0B0' },
  claimBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  claimBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 12 },
  claimBadgeText: { fontSize: 12, fontWeight: '600' },
  claimRow: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  claimRowLeft: { gap: 2 },
  claimRowDate: { fontSize: 13, fontWeight: '600', color: '#2C2C2A' },
  claimRowTime: { fontSize: 12, color: '#888' },
  claimRowLocation: { fontSize: 12, color: '#aaa' },
})
