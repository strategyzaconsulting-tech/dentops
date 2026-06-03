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

interface TrainingSession {
  id: string
  topic: string
  scheduledAt: string
  completedAt: string | null
  notes: string | null
  trainer: { id: string; firstName: string; lastName: string; role: string } | null
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function TrainingScreen() {
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      loadSessions()
    }, [])
  )

  async function loadSessions() {
    setLoading(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/training?practiceId=${PRACTICE_ID}&userId=${USER_ID}`
      )
      if (res.ok) {
        const data = await res.json()
        setSessions(Array.isArray(data) ? data : [])
      }
    } catch { /* no-op */ }
    setLoading(false)
  }

  const upcoming = sessions.filter((s) => !s.completedAt)
  const completed = sessions.filter((s) => s.completedAt)

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Training Schedule</Text>
        {!loading && (
          <Text style={styles.headerSub}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} · {completed.length} completed
          </Text>
        )}
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1D9E75" size="large" />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyText}>No training sessions scheduled yet</Text>
          <Text style={styles.emptySubText}>Your manager will add sessions here when they are ready.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {upcoming.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Upcoming</Text>
              {upcoming.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </>
          )}

          {completed.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Completed</Text>
              {completed.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <BottomNav />
    </View>
  )
}

function SessionCard({ session }: { session: TrainingSession }) {
  const isCompleted = !!session.completedAt
  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      <View style={styles.cardTop}>
        <View style={[styles.statusDot, isCompleted ? styles.statusDotDone : styles.statusDotUpcoming]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.topic}>{session.topic}</Text>
          <Text style={styles.dateText}>{fmtDateTime(session.scheduledAt)}</Text>
        </View>
        <View style={[styles.badge, isCompleted ? styles.badgeDone : styles.badgeUpcoming]}>
          <Text style={[styles.badgeText, isCompleted ? styles.badgeTextDone : styles.badgeTextUpcoming]}>
            {isCompleted ? 'Completed' : 'Upcoming'}
          </Text>
        </View>
      </View>

      {session.trainer && (
        <View style={styles.trainerRow}>
          <Text style={styles.trainerLabel}>Trainer:</Text>
          <Text style={styles.trainerName}>
            {session.trainer.firstName} {session.trainer.lastName} · {session.trainer.role}
          </Text>
        </View>
      )}

      {session.notes && (
        <Text style={styles.notes}>{session.notes}</Text>
      )}

      {isCompleted && session.completedAt && (
        <Text style={styles.completedDate}>
          Completed {new Date(session.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1EFE8' },
  header: {
    backgroundColor: '#1D9E75',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 2 },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#555', textAlign: 'center' },
  emptySubText: { fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center', lineHeight: 20 },
  scroll: { padding: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 8,
  },
  cardCompleted: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  statusDotUpcoming: { backgroundColor: '#F59E0B' },
  statusDotDone: { backgroundColor: '#1D9E75' },
  topic: { fontSize: 16, fontWeight: '700', color: '#1D1D1B', marginBottom: 2 },
  dateText: { fontSize: 13, color: '#666' },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeUpcoming: { backgroundColor: '#FEF3C7' },
  badgeDone: { backgroundColor: '#D1FAE5' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextUpcoming: { color: '#D97706' },
  badgeTextDone: { color: '#065F46' },
  trainerRow: { flexDirection: 'row', gap: 6, paddingLeft: 20 },
  trainerLabel: { fontSize: 12, color: '#888', fontWeight: '600' },
  trainerName: { fontSize: 12, color: '#555' },
  notes: { fontSize: 13, color: '#666', fontStyle: 'italic', paddingLeft: 20 },
  completedDate: { fontSize: 12, color: '#1D9E75', fontWeight: '600', paddingLeft: 20 },
})
