import { useEffect, useState } from 'react'
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

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const API_BASE = 'http://192.168.0.137:3000'

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
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchAnnouncements() {
    try {
      const res = await fetch(`${API_BASE}/api/announcements?practiceId=${PRACTICE_ID}`)
      const data: Announcement[] = await res.json()
      if (Array.isArray(data)) setAnnouncements(data)
    } catch { /* silent */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchAnnouncements() }, [])

  function onRefresh() {
    setRefreshing(true)
    fetchAnnouncements()
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
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
              <Text style={styles.emptyIcon}>📢</Text>
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
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 48 },
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
