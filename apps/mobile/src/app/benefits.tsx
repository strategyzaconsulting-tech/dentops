import { useEffect, useState } from 'react'
import BottomNav from '../components/BottomNav'
import {
  ActivityIndicator,
  RefreshControl,
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

interface Benefit {
  id: string
  name: string
  isDefault: boolean
  enabled: boolean
}

const BENEFIT_ICONS: Record<string, string> = {
  'PTO': '🏖️',
  'Health Insurance': '🏥',
  'Retirement Plan': '💰',
}

function getBenefitIcon(name: string) {
  return BENEFIT_ICONS[name] ?? '✅'
}

export default function BenefitsScreen() {
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchBenefits() {
    try {
      const res = await fetch(`${API_BASE}/api/benefits/user?practiceId=${PRACTICE_ID}&userId=${USER_ID}`)
      const data: Benefit[] = await res.json()
      if (Array.isArray(data)) setBenefits(data)
    } catch { /* silent */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    markModuleSeen('benefits' as never)
    fetchBenefits()
  }, [])

  function onRefresh() {
    setRefreshing(true)
    fetchBenefits()
  }

  const active = benefits.filter((b) => b.enabled)
  const inactive = benefits.filter((b) => !b.enabled)

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Benefits</Text>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D9E75" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D9E75" />}
        >
          {/* Active benefits */}
          <Text style={styles.sectionLabel}>Active Benefits</Text>
          {active.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No benefits activated yet.</Text>
              <Text style={styles.emptySubtext}>Contact your manager after your probationary period.</Text>
            </View>
          ) : (
            active.map((b) => (
              <View key={b.id} style={styles.benefitCard}>
                <View style={styles.benefitIcon}>
                  <Text style={styles.benefitIconText}>{getBenefitIcon(b.name)}</Text>
                </View>
                <View style={styles.benefitInfo}>
                  <Text style={styles.benefitName}>{b.name}</Text>
                  <Text style={styles.benefitStatus}>Active</Text>
                </View>
                <View style={styles.activeDot} />
              </View>
            ))
          )}

          {/* Inactive benefits */}
          {inactive.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Not Yet Active</Text>
              {inactive.map((b) => (
                <View key={b.id} style={[styles.benefitCard, styles.benefitCardInactive]}>
                  <View style={[styles.benefitIcon, styles.benefitIconInactive]}>
                    <Text style={styles.benefitIconText}>{getBenefitIcon(b.name)}</Text>
                  </View>
                  <View style={styles.benefitInfo}>
                    <Text style={[styles.benefitName, styles.benefitNameInactive]}>{b.name}</Text>
                    <Text style={styles.benefitStatusInactive}>Pending eligibility</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
      <BottomNav activeRoute="benefits" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1EFE8' },
  header: {
    backgroundColor: '#1D9E75',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 24, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#555' },
  emptySubtext: { fontSize: 12, color: '#aaa', textAlign: 'center' },
  benefitCard: {
    backgroundColor: '#fff', borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  benefitCardInactive: { opacity: 0.55 },
  benefitIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#E8F5F0', alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  benefitIconInactive: { backgroundColor: '#F0F0F0' },
  benefitIconText: { fontSize: 22 },
  benefitInfo: { flex: 1 },
  benefitName: { fontSize: 15, fontWeight: '700', color: '#2C2C2A' },
  benefitNameInactive: { color: '#888' },
  benefitStatus: { fontSize: 12, color: '#1D9E75', fontWeight: '600', marginTop: 2 },
  benefitStatusInactive: { fontSize: 12, color: '#aaa', marginTop: 2 },
  activeDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D9E75',
  },
})
