import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import BottomNav from '../components/BottomNav'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

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

interface Benefit {
  id: string
  name: string
  enabled: boolean
  providerName: string | null
  phone: string | null
  email: string | null
  website: string | null
  notes: string | null
}

function getBenefitIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes('health')) return '🏥'
  if (n.includes('dental')) return '🦷'
  if (n.includes('vision')) return '👁️'
  if (n.includes('retire') || n.includes('401')) return '💰'
  if (n.includes('pto') || n.includes('vacation') || n.includes('time off')) return '🏖️'
  if (n.includes('commut')) return '🚇'
  if (n.includes('life')) return '🛡️'
  return '✅'
}


export default function OnboardingScreen() {
  const { user } = useAuth()
  const practiceId = user?.practiceId ?? ''
  const userId = user?.id ?? ''

  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [training, setTraining] = useState<TrainingSession[]>([])
  const [benefits, setBenefits] = useState<Benefit[]>([])
  const [loading, setLoading] = useState(true)
  const [w4ReviewRequired, setW4ReviewRequired] = useState(false)
  const [completingReview, setCompletingReview] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (practiceId && userId) loadData()
    }, [practiceId, userId])
  )

  async function loadData() {
    setLoading(true)
    try {
      const year = new Date().getFullYear()
      const [cl, tr, rev, ben] = await Promise.allSettled([
        apiFetch(`/api/onboarding?practiceId=${practiceId}&userId=${userId}`).then((r) => r.json()),
        apiFetch(`/api/training?practiceId=${practiceId}&userId=${userId}`).then((r) => r.json()),
        apiFetch(`/api/w4-review/status?practiceId=${practiceId}&userId=${userId}&year=${year}`).then((r) => r.json()),
        apiFetch(`/api/benefits/user?practiceId=${practiceId}&userId=${userId}`).then((r) => r.json()),
      ])
      if (cl.status === 'fulfilled' && cl.value?.id) setChecklist(cl.value)
      if (tr.status === 'fulfilled' && Array.isArray(tr.value)) setTraining(tr.value)
      if (rev.status === 'fulfilled' && rev.value?.required && !rev.value?.completed) {
        setW4ReviewRequired(true)
      }
      if (ben.status === 'fulfilled' && Array.isArray(ben.value)) {
        setBenefits(ben.value.filter((b: Benefit) => b.enabled))
      }
    } catch { /* no-op */ }
    setLoading(false)
  }

  async function handleW4ReviewComplete(changed: boolean) {
    setCompletingReview(true)
    try {
      await apiFetch('/api/w4-review/complete', {
        method: 'POST',
        body: JSON.stringify({ practiceId, userId, changed }),
      })
      setW4ReviewRequired(false)
      if (changed) {
        router.push({ pathname: '/onboarding-form', params: { type: 'w4' } })
      }
    } catch { /* no-op */ }
    setCompletingReview(false)
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

  const allSectionAComplete =
    !!checklist?.i9CompletedAt &&
    !!checklist?.w4CompletedAt &&
    !!checklist?.personalInfoCompletedAt &&
    !!checklist?.emergencyContactCompletedAt &&
    !!checklist?.directDepositCompletedAt

  const hideSectionA = user?.seasonedEmployee || allSectionAComplete

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
        {!hideSectionA && (
          <>
            <Text style={styles.headerSub}>{totalComplete} of 6 new hire forms complete</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{progressPct}% complete</Text>
          </>
        )}
        {allSectionAComplete && !user?.seasonedEmployee && (
          <Text style={styles.headerSub}>Onboarding complete</Text>
        )}
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Section A — HR Forms (hidden for seasoned employees and once completed) */}
        {!hideSectionA && (
          <>
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
                    {item.done && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.checkLabel, item.done && styles.checkLabelComplete]}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#C0C0C0" />
                </TouchableOpacity>
              ))}

              {/* Equipment log — read-only */}
              <View style={[styles.checkRow]}>
                <View style={[styles.checkCircle, (checklist?.equipmentItems?.length ?? 0) > 0 && styles.checkCircleDone]}>
                  {(checklist?.equipmentItems?.length ?? 0) > 0 && <Ionicons name="checkmark" size={14} color="#fff" />}
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
          </>
        )}

        {/* Section B — Office & Team */}
        <Text style={styles.sectionTitle}>Section B — Office &amp; Team</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.checkRow, (!user?.seasonedEmployee) && styles.checkRowBorder]}
            onPress={() => router.push('/office-manual' as never)}
          >
            <View style={styles.navIcon}><Text style={styles.navIconText}>📄</Text></View>
            <Text style={styles.checkLabel}>Office Manual</Text>
            <Ionicons name="chevron-forward" size={18} color="#C0C0C0" />
          </TouchableOpacity>

          {!user?.seasonedEmployee && (
            <>
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
                <Ionicons name="chevron-forward" size={18} color="#C0C0C0" />
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
            </>
          )}

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => router.push('/team-directory' as never)}
          >
            <View style={styles.navIcon}><Text style={styles.navIconText}>🏢</Text></View>
            <Text style={styles.checkLabel}>Team Directory</Text>
            <Ionicons name="chevron-forward" size={18} color="#C0C0C0" />
          </TouchableOpacity>
        </View>

        {/* â”€â”€ Section C — My Records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Text style={styles.sectionTitle}>Section C — My Records</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => router.push('/hr-documents' as never)}
          >
            <View style={styles.navIcon}><Text style={styles.navIconText}>📋</Text></View>
            <Text style={styles.checkLabel}>HR Documents</Text>
            <Ionicons name="chevron-forward" size={18} color="#C0C0C0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => router.push('/my-licenses' as never)}
          >
            <View style={styles.navIcon}><Text style={styles.navIconText}>🪪</Text></View>
            <Text style={styles.checkLabel}>My Licenses &amp; Certifications</Text>
            <Ionicons name="chevron-forward" size={18} color="#C0C0C0" />
          </TouchableOpacity>
        </View>

        {/* Section D — Benefits */}
        <Text style={styles.sectionTitle}>Section D — Benefits</Text>
        <View style={styles.card}>
          {benefits.length === 0 ? (
            <View style={[styles.checkRow]}>
              <View style={styles.navIcon}><Text style={styles.navIconText}>🎁</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkLabel}>No active benefits yet</Text>
                <Text style={styles.subText}>Contact your manager after your probationary period.</Text>
              </View>
            </View>
          ) : (
            benefits.map((b, idx) => {
              const hasContact = !!(b.phone || b.email || b.website)
              return (
                <View key={b.id} style={[styles.benefitSection, idx < benefits.length - 1 && styles.checkRowBorder]}>
                  <View style={styles.checkRow}>
                    <View style={styles.navIcon}><Text style={styles.navIconText}>{getBenefitIcon(b.name)}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkLabel}>{b.name}</Text>
                      {b.providerName ? <Text style={styles.subText}>{b.providerName}</Text> : null}
                    </View>
                  </View>
                  {hasContact && (
                    <View style={styles.contactRow}>
                      {b.phone && (
                        <TouchableOpacity onPress={() => Linking.openURL(`tel:${b.phone}`)} style={styles.contactChip}>
                          <Text style={styles.contactChipText}>📞 {b.phone}</Text>
                        </TouchableOpacity>
                      )}
                      {b.email && (
                        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${b.email}`)} style={styles.contactChip}>
                          <Text style={styles.contactChipText}>✉️ {b.email}</Text>
                        </TouchableOpacity>
                      )}
                      {b.website && (
                        <TouchableOpacity onPress={() => Linking.openURL(b.website!)} style={styles.contactChip}>
                          <Text style={[styles.contactChipText, { color: '#1D9E75' }]}>🌐 Member Portal</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {b.notes ? <Text style={styles.benefitNotes}>{b.notes}</Text> : null}
                </View>
              )
            })
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <BottomNav activeRoute="onboarding" />

      {/* Mandatory W-4 Annual Review Modal */}
      <Modal visible={w4ReviewRequired} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalBadge}>
              <Text style={styles.modalBadgeText}>Annual Review Required</Text>
            </View>
            <Text style={styles.modalTitle}>W-4 Withholding Review</Text>
            <Text style={styles.modalBody}>
              Federal guidelines recommend reviewing your W-4 withholding each year. Please confirm whether your information is still accurate or update it now.
            </Text>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary, completingReview && styles.modalBtnDisabled]}
              onPress={() => handleW4ReviewComplete(false)}
              disabled={completingReview}
            >
              {completingReview ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalBtnPrimaryText}>No Changes — Looks Good</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnSecondary, completingReview && styles.modalBtnDisabled]}
              onPress={() => handleW4ReviewComplete(true)}
              disabled={completingReview}
            >
              <Text style={styles.modalBtnSecondaryText}>Update My W-4</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  checkLabel: { flex: 1, fontSize: 15, color: '#2C2C2A', fontWeight: '500' },
  checkLabelComplete: { flex: 1, fontSize: 15, color: '#1D9E75', fontWeight: '500' },
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
  benefitSection: { paddingBottom: 4 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  contactChip: {
    backgroundColor: '#F0FAF6', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  contactChipText: { fontSize: 12, color: '#2C2C2A', fontWeight: '500' },
  benefitNotes: { fontSize: 12, color: '#777', paddingHorizontal: 16, paddingBottom: 12, lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  modalBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modalBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  modalBody: { fontSize: 14, color: '#555', lineHeight: 20 },
  modalBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: '#1D9E75' },
  modalBtnSecondary: { borderWidth: 1.5, borderColor: '#1D9E75' },
  modalBtnDisabled: { opacity: 0.5 },
  modalBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalBtnSecondaryText: { color: '#1D9E75', fontSize: 15, fontWeight: '600' },
})
