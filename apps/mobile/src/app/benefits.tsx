import { useEffect, useState } from 'react'
import BottomNav from '../components/BottomNav'
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { markModuleSeen } from '../store/navBadgeStore'
import { useAuth } from '../lib/AuthContext'
import { apiFetch } from '../lib/api'

interface Benefit {
  id: string
  name: string
  isDefault: boolean
  enabled: boolean
  providerName: string | null
  phone: string | null
  email: string | null
  website: string | null
  notes: string | null
}

const BENEFIT_ICONS: Record<string, string> = {
  'Health Insurance': '🏥',
  'Dental Plan': '🦷',
  'Vision Plan': '👁️',
  'Retirement Plan (401k)': '💰',
  'Retirement Plan': '💰',
  'PTO': '🏖️',
  'Commuter Benefits': '🚇',
  'Life Insurance': '🛡️',
}

function getBenefitIcon(name: string) {
  return BENEFIT_ICONS[name] ?? '✅'
}

export default function BenefitsScreen() {
  const { user } = useAuth()
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function fetchBenefits() {
    if (!user) return
    try {
      const res = await apiFetch(`/api/benefits/user?practiceId=${user.practiceId}&userId=${user.id}`)
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
            active.map((b) => {
              const isOpen = expandedId === b.id
              const hasDetails = !!(b.providerName || b.phone || b.email || b.website || b.notes)
              return (
                <View key={b.id} style={styles.benefitCard}>
                  <TouchableOpacity
                    activeOpacity={hasDetails ? 0.7 : 1}
                    onPress={() => hasDetails && setExpandedId(isOpen ? null : b.id)}
                    style={styles.benefitRow}
                  >
                    <View style={styles.benefitIcon}>
                      <Text style={styles.benefitIconText}>{getBenefitIcon(b.name)}</Text>
                    </View>
                    <View style={styles.benefitInfo}>
                      <Text style={styles.benefitName}>{b.name}</Text>
                      {b.providerName ? (
                        <Text style={styles.providerName}>{b.providerName}</Text>
                      ) : (
                        <Text style={styles.benefitStatus}>Active</Text>
                      )}
                    </View>
                    <View style={styles.rightCol}>
                      <View style={styles.activeDot} />
                      {hasDetails && (
                        <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.detailsPanel}>
                      {b.phone && (
                        <TouchableOpacity onPress={() => Linking.openURL(`tel:${b.phone}`)} style={styles.detailRow}>
                          <Text style={styles.detailIcon}>📞</Text>
                          <View style={styles.detailText}>
                            <Text style={styles.detailLabel}>Support Phone</Text>
                            <Text style={styles.detailValue}>{b.phone}</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      {b.email && (
                        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${b.email}`)} style={styles.detailRow}>
                          <Text style={styles.detailIcon}>✉️</Text>
                          <View style={styles.detailText}>
                            <Text style={styles.detailLabel}>Support Email</Text>
                            <Text style={styles.detailValue}>{b.email}</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      {b.website && (
                        <TouchableOpacity onPress={() => Linking.openURL(b.website!)} style={styles.detailRow}>
                          <Text style={styles.detailIcon}>🌐</Text>
                          <View style={styles.detailText}>
                            <Text style={styles.detailLabel}>Member Portal</Text>
                            <Text style={[styles.detailValue, styles.linkText]} numberOfLines={1}>{b.website}</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      {b.notes && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailIcon}>📋</Text>
                          <View style={styles.detailText}>
                            <Text style={styles.detailLabel}>Notes</Text>
                            <Text style={styles.detailValue}>{b.notes}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )
            })
          )}

          {/* Inactive benefits */}
          {inactive.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Not Yet Active</Text>
              {inactive.map((b) => (
                <View key={b.id} style={[styles.benefitCard, styles.benefitCardInactive]}>
                  <View style={styles.benefitRow}>
                    <View style={[styles.benefitIcon, styles.benefitIconInactive]}>
                      <Text style={styles.benefitIconText}>{getBenefitIcon(b.name)}</Text>
                    </View>
                    <View style={styles.benefitInfo}>
                      <Text style={[styles.benefitName, styles.benefitNameInactive]}>{b.name}</Text>
                      <Text style={styles.benefitStatusInactive}>Pending eligibility</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
      <BottomNav activeRoute="onboarding" />
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
    marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    overflow: 'hidden',
  },
  benefitCardInactive: { opacity: 0.55 },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14,
  },
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
  providerName: { fontSize: 12, color: '#666', fontWeight: '500', marginTop: 2 },
  benefitStatus: { fontSize: 12, color: '#1D9E75', fontWeight: '600', marginTop: 2 },
  benefitStatusInactive: { fontSize: 12, color: '#aaa', marginTop: 2 },
  rightCol: { alignItems: 'center', gap: 4 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D9E75' },
  chevron: { fontSize: 9, color: '#aaa', marginTop: 4 },

  // Details panel
  detailsPanel: {
    borderTopWidth: 1, borderTopColor: '#F0EDE5',
    backgroundColor: '#FAFAF8',
    paddingHorizontal: 14, paddingVertical: 10,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  detailIcon: { fontSize: 18, marginTop: 1 },
  detailText: { flex: 1 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.4 },
  detailValue: { fontSize: 13, color: '#2C2C2A', marginTop: 2 },
  linkText: { color: '#1D9E75' },
})
