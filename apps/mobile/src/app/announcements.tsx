import { useCallback, useLayoutEffect, useState } from 'react'
import BottomNav from '../components/BottomNav'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { markAnnouncementsSeen } from '../store/announcementStore'
import { useAuth } from '../lib/AuthContext'
import { apiFetch } from '../lib/api'

interface Announcement {
  id: string
  title: string
  body: string
  createdAt: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function AnnouncementsScreen() {
  const { user } = useAuth()
  const practiceId = user?.practiceId ?? ''

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchAnnouncements() {
    if (!practiceId) return
    try {
      const res = await apiFetch(`/api/announcements?practiceId=${practiceId}`)
      const data: Announcement[] = await res.json()
      if (Array.isArray(data)) setAnnouncements(data)
    } catch { /* silent */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useLayoutEffect(() => { markAnnouncementsSeen() }, [])

  useFocusEffect(useCallback(() => { fetchAnnouncements() }, [practiceId]))

  function onRefresh() {
    setRefreshing(true)
    fetchAnnouncements()
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <Text style={styles.headerTitle}>Announcements</Text>
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
          {announcements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="megaphone-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No announcements yet</Text>
            </View>
          ) : (
            announcements.map((a) => (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardAccent} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{a.title}</Text>
                  <Text style={styles.cardBody}>{a.body}</Text>
                  <Text style={styles.cardDate}>{formatDate(a.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
      <BottomNav activeRoute="announcements" />
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
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: '#999' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardAccent: { width: 4, backgroundColor: '#1D9E75' },
  cardContent: { flex: 1, padding: 16, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#2C2C2A' },
  cardBody: { fontSize: 14, color: '#555', lineHeight: 20 },
  cardDate: { fontSize: 12, color: '#aaa', marginTop: 4 },
})
