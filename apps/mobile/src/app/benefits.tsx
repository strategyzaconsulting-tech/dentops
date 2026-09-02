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

type BenefitTheme = { icon: string; bg: string; accent: string }

function getBenefitTheme(name: string): BenefitTheme {
  const n = name.toLowerCase()
  if (n.includes('health'))                          return { icon: '🏥', bg: '#FFF0F2', accent: '#E05C6A' }
  if (n.includes('dental'))                          return { icon: '🦷', bg: '#EDF4FF', accent: '#3B82F6' }
  if (n.includes('vision'))                          return { icon: '👁️', bg: '#F3EEFF', accent: '#8B5CF6' }
  if (n.includes('retire') || n.includes('401'))     return { icon: '💰', bg: '#FFFAEB', accent: '#D97706' }
  if (n.includes('pto') || n.includes('vacation') || n.includes('time off'))
                                                     return { icon: '🏖️', bg: '#EDFAF4', accent: '#1D9E75' }
  if (n.includes('commut'))                          return { icon: '🚇', bg: '#FFF4ED', accent: '#EA580C' }
  if (n.includes('life'))                            return { icon: '🛡️', bg: '#EEF2FF', accent: '#6366F1' }
  return                                                    { icon: '✅', bg: '#F3F4F6', accent: '#6B7280' }
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
        <Text style={styles.headerSub}>
          {active.length} active plan{active.length !== 1 ? 's' : ''}
        </Text>
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
          {active.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🎁</Text>
              <Text style={styles.emptyText}>No active benefits yet</Text>
              <Text style={styles.emptySubtext}>Your benefits will appear here once activated by your manager.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Active Plans</Text>
              {active.map((b) => {
                const theme = getBenefitTheme(b.name)
                const isOpen = expandedId === b.id
                const hasDetails = !!(b.providerName || b.phone || b.email || b.website || b.notes)
                return (
                  <View key={b.id} style={styles.card}>
                    {/* Accent strip */}
                    <View style={[styles.accentStrip, { backgroundColor: theme.accent }]} />

                    <TouchableOpacity
                      activeOpacity={hasDetails ? 0.7 : 1}
                      onPress={() => hasDetails && setExpandedId(isOpen ? null : b.id)}
                      style={styles.cardMain}
                    >
                      {/* Icon bubble */}
                      <View style={[styles.iconBubble, { backgroundColor: theme.bg }]}>
                        <Text style={styles.iconText}>{theme.icon}</Text>
                      </View>

                      {/* Name + provider */}
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName}>{b.name}</Text>
                        {b.providerName
                          ? <Text style={styles.cardProvider}>{b.providerName}</Text>
                          : <View style={[styles.activePill, { backgroundColor: theme.bg }]}>
                              <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />
                              <Text style={[styles.activePillText, { color: theme.accent }]}>Active</Text>
                            </View>
                        }
                      </View>

                      {/* Chevron */}
                      {hasDetails && (
                        <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
                      )}
                    </TouchableOpacity>

                    {/* Expanded details */}
                    {isOpen && (
                      <View style={styles.details}>
                        {b.providerName && (
                          <View style={styles.detailProviderRow}>
                            <Text style={styles.detailProviderLabel}>Provider</Text>
                            <Text style={styles.detailProviderName}>{b.providerName}</Text>
                          </View>
                        )}

                        {/* Action buttons */}
                        {(b.phone || b.email || b.website) && (
                          <View style={styles.actionRow}>
                            {b.phone && (
                              <TouchableOpacity
                                onPress={() => Linking.openURL(`tel:${b.phone}`)}
                                style={[styles.actionBtn, { backgroundColor: theme.bg, borderColor: theme.accent + '40' }]}
                              >
                                <Text style={styles.actionBtnIcon}>📞</Text>
                                <Text style={[styles.actionBtnText, { color: theme.accent }]}>Call</Text>
                              </TouchableOpacity>
                            )}
                            {b.email && (
                              <TouchableOpacity
                                onPress={() => Linking.openURL(`mailto:${b.email}`)}
                                style={[styles.actionBtn, { backgroundColor: theme.bg, borderColor: theme.accent + '40' }]}
                              >
                                <Text style={styles.actionBtnIcon}>✉️</Text>
                                <Text style={[styles.actionBtnText, { color: theme.accent }]}>Email</Text>
                              </TouchableOpacity>
                            )}
                            {b.website && (
                              <TouchableOpacity
                                onPress={() => Linking.openURL(b.website!)}
                                style={[styles.actionBtn, { backgroundColor: theme.bg, borderColor: theme.accent + '40' }]}
                              >
                                <Text style={styles.actionBtnIcon}>🌐</Text>
                                <Text style={[styles.actionBtnText, { color: theme.accent }]}>Portal</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}

                        {b.notes && (
                          <View style={styles.notesBox}>
                            <Text style={styles.notesLabel}>Notes</Text>
                            <Text style={styles.notesText}>{b.notes}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )
              })}
            </>
          )}

          {/* Inactive benefits */}
          {inactive.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Not Yet Eligible</Text>
              <View style={styles.inactiveGroup}>
                {inactive.map((b, idx) => {
                  const theme = getBenefitTheme(b.name)
                  const isLast = idx === inactive.length - 1
                  return (
                    <View key={b.id} style={[styles.inactiveRow, !isLast && styles.inactiveRowBorder]}>
                      <View style={[styles.inactiveIconBubble, { backgroundColor: theme.bg }]}>
                        <Text style={styles.inactiveIconText}>{theme.icon}</Text>
                      </View>
                      <Text style={styles.inactiveName}>{b.name}</Text>
                      <Text style={styles.inactiveLock}>🔒</Text>
                    </View>
                  )
                })}
              </View>
              <Text style={styles.inactiveHint}>Contact your manager to activate additional plans.</Text>
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
      <BottomNav activeRoute="onboarding" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F2EB' },

  // Header
  header: {
    backgroundColor: '#1D9E75',
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginTop: 2 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 32, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#444', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 18 },

  // Active card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
    overflow: 'hidden',
  },
  accentStrip: { width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  cardMain: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14,
  },
  iconBubble: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  iconText: { fontSize: 24 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1C1C1A', marginBottom: 4 },
  cardProvider: { fontSize: 12, color: '#777', fontWeight: '500' },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activePillText: { fontSize: 11, fontWeight: '700' },
  chevron: { fontSize: 10, color: '#bbb', marginLeft: 8 },

  // Expanded details
  details: {
    borderTopWidth: 1, borderTopColor: '#F0EDE5',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    backgroundColor: '#FAFAF8',
    gap: 12,
  },
  detailProviderRow: { gap: 2 },
  detailProviderLabel: {
    fontSize: 10, fontWeight: '700', color: '#bbb',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  detailProviderName: { fontSize: 14, fontWeight: '600', color: '#333' },

  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 24, borderWidth: 1,
  },
  actionBtnIcon: { fontSize: 14 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

  notesBox: {
    backgroundColor: '#fff', borderRadius: 10,
    padding: 12, gap: 4,
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  notesLabel: {
    fontSize: 10, fontWeight: '700', color: '#bbb',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  notesText: { fontSize: 13, color: '#555', lineHeight: 18 },

  // Inactive group
  inactiveGroup: {
    backgroundColor: '#fff', borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  inactiveRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  inactiveRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F2F0EA' },
  inactiveIconBubble: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, opacity: 0.5,
  },
  inactiveIconText: { fontSize: 18 },
  inactiveName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#B0ADA5' },
  inactiveLock: { fontSize: 13, opacity: 0.5 },
  inactiveHint: {
    fontSize: 12, color: '#aaa', textAlign: 'center',
    marginTop: 10, lineHeight: 17,
  },
})
