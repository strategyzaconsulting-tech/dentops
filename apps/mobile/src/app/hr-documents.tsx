import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import BottomNav from '../components/BottomNav'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

const TYPE_LABEL: Record<string, string> = {
  verbal_warning:   'Verbal Warning',
  written_warning:  'Written Warning',
  performance_note: 'Performance Note',
  termination:      'Termination Record',
}

const TYPE_COLOR: Record<string, string> = {
  verbal_warning:   '#D97706',
  written_warning:  '#E11D48',
  performance_note: '#3B82F6',
  termination:      '#111827',
}

interface HRDoc {
  id: string
  date: string
  type: string
  title: string | null
  body: string | null
  notes: string | null
  managerSignatureName: string | null
  managerSignedAt: string | null
  manager: { firstName: string; lastName: string; role: string } | null
  staffAcknowledgedAt: string | null
  staffSignatureName: string | null
  createdAt: string
}

function fmtDate(iso: string) {
  return new Date(iso.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function fmtTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function HRDocumentsScreen() {
  const { user } = useAuth()
  const practiceId = user?.practiceId ?? ''
  const userId = user?.id ?? ''

  const [docs, setDocs] = useState<HRDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<HRDoc | null>(null)
  const [ackName, setAckName] = useState('')
  const [savingAck, setSavingAck] = useState(false)

  const FORMAL_TYPES = new Set(['verbal_warning', 'written_warning', 'performance_note', 'termination'])

  useFocusEffect(useCallback(() => {
    if (practiceId && userId) load()
  }, [practiceId, userId]))

  async function load() {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/occurrences?practiceId=${practiceId}&userId=${userId}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setDocs(data.filter((d: HRDoc) => FORMAL_TYPES.has(d.type)).reverse())
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  async function acknowledge() {
    if (!viewing || !ackName.trim()) return
    setSavingAck(true)
    try {
      const res = await apiFetch(`/api/occurrences/${viewing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ acknowledge: true, staffSignatureName: ackName.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDocs(prev => prev.map(d => d.id === updated.id ? updated : d))
        setViewing(updated)
        setAckName('')
        Alert.alert('Acknowledged', 'Your acknowledgment has been recorded.')
      }
    } catch { /* silent */ }
    finally { setSavingAck(false) }
  }

  const unacked = docs.filter(d => !d.staffAcknowledgedAt).length

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>HR Documents</Text>
        {unacked > 0 && (
          <View style={s.badge}><Text style={s.badgeText}>{unacked}</Text></View>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#1D9E75" /></View>
      ) : docs.length === 0 ? (
        <View style={s.center}>
          <Text style={s.empty}>No HR documents on file.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {unacked > 0 && (
            <View style={s.alertBanner}>
              <Text style={s.alertText}>⚠ {unacked} document{unacked > 1 ? 's' : ''} require your acknowledgment</Text>
            </View>
          )}
          {docs.map(doc => {
            const needsAck = !doc.staffAcknowledgedAt
            const color = TYPE_COLOR[doc.type] ?? '#6B7280'
            return (
              <TouchableOpacity key={doc.id} style={[s.card, needsAck && s.cardUnacked]} onPress={() => { setViewing(doc); setAckName('') }}>
                <View style={[s.typeBar, { backgroundColor: color }]} />
                <View style={s.cardBody}>
                  <View style={s.cardTop}>
                    <View style={[s.typePill, { backgroundColor: color + '20' }]}>
                      <Text style={[s.typeLabel, { color }]}>{TYPE_LABEL[doc.type] ?? doc.type}</Text>
                    </View>
                    {needsAck && <View style={s.needsAckDot} />}
                  </View>
                  <Text style={s.docTitle}>{doc.title ?? TYPE_LABEL[doc.type]}</Text>
                  <Text style={s.docDate}>{fmtDate(doc.date)}</Text>
                  {doc.managerSignatureName && (
                    <Text style={s.signedBy}>Signed by {doc.managerSignatureName}</Text>
                  )}
                  <View style={s.statusRow}>
                    {doc.staffAcknowledgedAt ? (
                      <Text style={s.acked}>✓ Acknowledged</Text>
                    ) : (
                      <Text style={s.pending}>⏳ Acknowledgment required</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* Document viewer modal */}
      <Modal visible={!!viewing} animationType="slide" presentationStyle="pageSheet">
        {viewing && (
          <SafeAreaView style={s.safe}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setViewing(null)}>
                <Text style={s.modalClose}>✕ Close</Text>
              </TouchableOpacity>
              <View style={[s.typePill, { backgroundColor: (TYPE_COLOR[viewing.type] ?? '#6B7280') + '20' }]}>
                <Text style={[s.typeLabel, { color: TYPE_COLOR[viewing.type] ?? '#6B7280' }]}>{TYPE_LABEL[viewing.type]}</Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={s.modalBody}>
              <Text style={s.modalTitle}>{viewing.title ?? TYPE_LABEL[viewing.type]}</Text>
              <Text style={s.modalDate}>{fmtDate(viewing.date)}</Text>

              {viewing.body ? (
                <Text style={s.bodyText}>{viewing.body}</Text>
              ) : viewing.notes ? (
                <Text style={s.bodyText}>{viewing.notes}</Text>
              ) : null}

              {/* Manager attestation */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>MANAGER ATTESTATION</Text>
                {viewing.managerSignatureName ? (
                  <>
                    <Text style={s.sigName}>✓ {viewing.managerSignatureName}</Text>
                    {viewing.manager && (
                      <Text style={s.sigRole}>{viewing.manager.firstName} {viewing.manager.lastName} · {viewing.manager.role.replace('_', ' ')}</Text>
                    )}
                    {viewing.managerSignedAt && (
                      <Text style={s.sigDate}>{fmtTs(viewing.managerSignedAt)}</Text>
                    )}
                  </>
                ) : (
                  <Text style={s.pendingText}>Awaiting manager signature</Text>
                )}
              </View>

              {/* Staff acknowledgment */}
              <View style={[s.section, !viewing.staffAcknowledgedAt && s.sectionOrange]}>
                <Text style={s.sectionLabel}>YOUR ACKNOWLEDGMENT</Text>
                {viewing.staffAcknowledgedAt ? (
                  <>
                    <Text style={s.sigName}>✓ {viewing.staffSignatureName}</Text>
                    <Text style={s.sigDate}>{fmtTs(viewing.staffAcknowledgedAt)}</Text>
                    <Text style={s.ackNote}>By signing, you confirmed receipt of this document. Acknowledgment does not imply agreement.</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.ackPrompt}>
                      By typing your name below you confirm you have received and read this document. This does not mean you agree with its contents.
                    </Text>
                    <TextInput
                      style={s.ackInput}
                      placeholder="Type your full name to acknowledge"
                      value={ackName}
                      onChangeText={setAckName}
                      autoCapitalize="words"
                    />
                    <TouchableOpacity
                      style={[s.ackBtn, (!ackName.trim() || savingAck) && s.ackBtnDisabled]}
                      onPress={acknowledge}
                      disabled={!ackName.trim() || savingAck}
                    >
                      <Text style={s.ackBtnText}>{savingAck ? 'Saving…' : 'Acknowledge Document'}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      <BottomNav activeRoute="onboarding" />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E8' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#2C3E3A' },
  back: { color: '#8BAF9A', fontSize: 14 },
  title: { flex: 1, color: '#FAF6EF', fontSize: 17, fontWeight: '700' },
  badge: { backgroundColor: '#E11D48', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#9CA3AF', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  alertBanner: { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 4 },
  alertText: { color: '#92400E', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardUnacked: { borderWidth: 1.5, borderColor: '#FCD34D' },
  typeBar: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typePill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  typeLabel: { fontSize: 11, fontWeight: '700' },
  needsAckDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },
  docTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  docDate: { fontSize: 12, color: '#6B7280' },
  signedBy: { fontSize: 11, color: '#059669' },
  statusRow: { marginTop: 2 },
  acked: { fontSize: 12, color: '#059669', fontWeight: '600' },
  pending: { fontSize: 12, color: '#D97706', fontWeight: '600' },
  // Modal
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalClose: { color: '#6B7280', fontSize: 15 },
  modalBody: { padding: 20, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  modalDate: { fontSize: 13, color: '#6B7280', marginTop: -10 },
  bodyText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  section: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, gap: 6 },
  sectionOrange: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, textTransform: 'uppercase' },
  sigName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sigRole: { fontSize: 12, color: '#6B7280' },
  sigDate: { fontSize: 12, color: '#9CA3AF' },
  pendingText: { fontSize: 13, color: '#D97706', fontStyle: 'italic' },
  ackPrompt: { fontSize: 13, color: '#374151', lineHeight: 20 },
  ackInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827' },
  ackBtn: { backgroundColor: '#1D9E75', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  ackBtnDisabled: { opacity: 0.5 },
  ackBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ackNote: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
})
