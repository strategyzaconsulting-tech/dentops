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
const API_BASE = 'http://192.168.0.137:3000'

interface StaffMember {
  id: string
  firstName: string
  lastName: string
  role: string
  email: string
  status: string
}

const LEADERSHIP_KEYWORDS = ['doctor', 'dr.', 'dds', 'dmd', 'manager', 'supervisor', 'director', 'owner']
const KEY_CONTACT_KEYWORDS = ['front desk', 'office manager', 'receptionist', 'coordinator', 'admin']

function isLeadership(role: string) {
  const r = role.toLowerCase()
  return LEADERSHIP_KEYWORDS.some((k) => r.includes(k))
}

function isKeyContact(role: string) {
  const r = role.toLowerCase()
  return KEY_CONTACT_KEYWORDS.some((k) => r.includes(k))
}

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? '?'}${lastName[0] ?? ''}`.toUpperCase()
}

const AVATAR_COLORS = ['#1D9E75', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16']
function avatarColor(str: string) {
  let hash = 0
  for (const ch of str) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function TeamDirectoryScreen() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      fetch(`${API_BASE}/api/staff?practiceId=${PRACTICE_ID}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setStaff(data)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }, [])
  )

  const leadership = staff.filter((s) => isLeadership(s.role))
  const keyContacts = staff.filter((s) => !isLeadership(s.role) && isKeyContact(s.role))
  const others = staff.filter((s) => !isLeadership(s.role) && !isKeyContact(s.role))

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Directory</Text>
        {!loading && <Text style={styles.headerSub}>{staff.length} team members</Text>}
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1D9E75" size="large" />
        </View>
      ) : staff.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No team members found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {leadership.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Supervisors &amp; Doctors</Text>
              {leadership.map((m) => <StaffCard key={m.id} member={m} />)}
            </>
          )}

          {keyContacts.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Key Contacts</Text>
              {keyContacts.map((m) => <StaffCard key={m.id} member={m} />)}
            </>
          )}

          {others.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Team</Text>
              {others.map((m) => <StaffCard key={m.id} member={m} />)}
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <BottomNav />
    </View>
  )
}

function StaffCard({ member }: { member: StaffMember }) {
  const color = avatarColor(`${member.firstName}${member.lastName}`)
  return (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{initials(member.firstName, member.lastName)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{member.firstName} {member.lastName}</Text>
        <Text style={styles.role}>{member.role}</Text>
        <Text style={styles.email}>{member.email}</Text>
      </View>
      <View style={[styles.statusDot, member.status === 'active' ? styles.dotActive : styles.dotInactive]} />
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
  emptyText: { fontSize: 16, color: '#888', fontWeight: '600' },
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
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', color: '#1D1D1B' },
  role: { fontSize: 12, color: '#888', marginTop: 1, textTransform: 'capitalize' },
  email: { fontSize: 11, color: '#1D9E75', marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#1D9E75' },
  dotInactive: { backgroundColor: '#D1D5DB' },
})
