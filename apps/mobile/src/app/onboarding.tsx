import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import BottomNav from '../components/BottomNav'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const USER_ID = '165234da-d643-41e8-8ec8-6e400d18a1d2'
const API_BASE = 'http://192.168.0.137:3000'

interface EquipmentItem {
  id: string
  name: string
  serialNumber: string | null
  assignedAt: string
  returnedAt: string | null
}

interface Checklist {
  id: string
  i9CompletedAt: string | null
  w4CompletedAt: string | null
  personalInfoCompletedAt: string | null
  emergencyContactCompletedAt: string | null
  directDepositCompletedAt: string | null
  equipmentItems: EquipmentItem[]
  completionPct: number
}

interface TrainingSession {
  id: string
  topic: string
  scheduledAt: string
  completedAt: string | null
  trainer: { id: string; firstName: string; lastName: string; role: string } | null
}


export default function OnboardingScreen() {
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [training, setTraining] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    setLoading(true)
    try {
      const [cl, tr] = await Promise.allSettled([
        fetch(`${API_BASE}/api/onboarding?practiceId=${PRACTICE_ID}&userId=${USER_ID}`).then((r) => r.json()),
        fetch(`${API_BASE}/api/training?practiceId=${PRACTICE_ID}&userId=${USER_ID}`).then((r) => r.json()),
      ])
      if (cl.status === 'fulfilled' && cl.value?.id) setChecklist(cl.value)
      if (tr.status === 'fulfilled' && Array.isArray(tr.value)) setTraining(tr.value)
    } catch { /* no-op */ }
    setLoading(false)
  }

  const assignedTrainer = training.length > 0 && training[0].trainer ? training[0].trainer : null

  const totalComplete =
    (checklist?.i9CompletedAt ? 1 : 0) +
    (checklist?.w4CompletedAt ? 1 : 0) +
    (checklist?.personalInfoCompletedAt ? 1 : 0) +
    (checklist?.emergencyContactCompletedAt ? 1 : 0) +
    (checklist?.directDepositCompletedAt ? 1 : 0) +
    ((checklist?.equipmentItems?.length ?? 0) > 0 ? 1 : 0)

  const SECTION_A = [
    { type: 'i9',               label: 'I-9 Employment Eligibility',  done: !!checklist?.i9CompletedAt },
    { type: 'w4',               label: 'W-4 Withholding Certificate', done: !!checklist?.w4CompletedAt },
    { type: 'personal-info',    label: 'Personal Information',        done: !!checklist?.personalInfoCompletedAt },
    { type: 'emergency-contact',label: 'Emergency Contact',           done: !!checklist?.emergencyContactCompletedAt },
    { type: 'direct-deposit',   label: 'Direct Deposit',              done: !!checklist?.directDepositCompletedAt },
  ]

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.header} edges={['top']}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </SafeAreaView>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#1D9E75" size="large" />
        </View>
        <BottomNav activeRoute="onboarding" />
      </View>
    )
  }

  const progressPct = checklist?.completionPct ?? Math.round((totalComplete / 6) * 100)

  return (
    <View style={styles.root}>
      {/* Teal header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <Text style={styles.headerSub}>{totalComplete} of 6 new hire forms complete</Text>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{progressPct}% complete</Text>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Section A — HR Forms */}
        <Text style={styles.sectionTitle}>Section A — HR Forms</Text>
        <View style={styles.card}>
          {SECTION_A.map((item, idx) => (
            <TouchableOpacity
              key={item.type}
              style={[styles.checkRow, idx < SECTION_A.length - 1 && styles.checkRowBorder]}
              onPress={() => router.push(`/onboarding-form?type=${item.type}` as never)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkCircle, item.done && styles.checkCircleDone]}>
                {item.done && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={[styles.checkLabel, item.done && styles.checkLabelComplete]}>{item.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}

          {/* Equipment log — read-only */}
          <View style={[styles.checkRow]}>
            <View style={[styles.checkCircle, (checklist?.equipmentItems?.length ?? 0) > 0 && styles.checkCircleDone]}>
              {(checklist?.equipmentItems?.length ?? 0) > 0 && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.checkLabel, (checklist?.equipmentItems?.length ?? 0) > 0 && styles.checkLabelComplete]}>
                Equipment Log
              </Text>
              {(checklist?.equipmentItems?.length ?? 0) > 0 ? (
                checklist!.equipmentItems.map((eq) => (
                  <Text key={eq.id} style={styles.equipItem}>
                    • {eq.name}{eq.serialNumber ? ` (S/N: ${eq.serialNumber})` : ''}{eq.returnedAt ? ' — Returned' : ''}
                  </Text>
                ))
              ) : (
                <Text style={styles.equipEmpty}>No equipment assigned yet</Text>
              )}
            </View>
          </View>
        </View>

        {/* Section B — Office & Team */}
        <Text style={styles.sectionTitle}>Section B — Office &amp; Team</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.checkRow, styles.checkRowBorder]}
            onPress={() => router.push('/office-manual' as never)}
          >
            <View style={styles.navIcon}><Text style={styles.navIconText}>📄</Text></View>
            <Text style={styles.checkLabel}>Office Manual</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.checkRow, styles.checkRowBorder]}
            onPress={() => router.push('/training' as never)}
          >
            <View style={styles.navIcon}><Text style={styles.navIconText}>📚</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkLabel}>Training Schedule</Text>
              {training.length > 0 && (
                <Text style={styles.subText}>{training.length} session{training.length > 1 ? 's' : ''} scheduled</Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {/* Assigned Trainer — inline card */}
          <View style={[styles.checkRow, styles.checkRowBorder]}>
            <View style={styles.navIcon}><Text style={styles.navIconText}>👤</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkLabel}>Assigned Trainer</Text>
              {assignedTrainer ? (
                <Text style={styles.subText}>
                  {assignedTrainer.firstName} {assignedTrainer.lastName} · {assignedTrainer.role}
                </Text>
              ) : (
                <Text style={styles.subText}>No trainer assigned yet</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => router.push('/team-directory' as never)}
          >
            <View style={styles.navIcon}><Text style={styles.navIconText}>🏢</Text></View>
            <Text style={styles.checkLabel}>Team Directory</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <BottomNav activeRoute="onboarding" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1EFE8' },
  header: {
    backgroundColor: '#1D9E75',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 10 },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: 6, backgroundColor: '#fff', borderRadius: 3 },
  progressLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  checkRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EBEBEB' },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 15, color: '#2C2C2A', fontWeight: '500' },
  checkLabelComplete: { flex: 1, fontSize: 15, color: '#1D9E75', fontWeight: '500' },
  chevron: { fontSize: 20, color: '#C0C0C0', fontWeight: '300' },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FAF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconText: { fontSize: 16 },
  subText: { fontSize: 12, color: '#888', marginTop: 2 },
  equipItem: { fontSize: 12, color: '#555', marginTop: 3 },
  equipEmpty: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 2 },
})
