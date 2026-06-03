import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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

interface OfficeManual {
  id: string
  title: string
  content: string
  version: string
  updatedAt: string
  signedByCurrentUser: boolean
  signatures: {
    id: string
    userId: string
    signedAt: string
    user: { id: string; firstName: string; lastName: string }
  }[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function OfficeManualScreen() {
  const [manual, setManual] = useState<OfficeManual | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)

  useFocusEffect(
    useCallback(() => {
      loadManual()
    }, [])
  )

  async function loadManual() {
    setLoading(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/office-manual?practiceId=${PRACTICE_ID}&userId=${USER_ID}`
      )
      if (res.ok) {
        const data = await res.json()
        setManual(data)
      } else {
        setManual(null)
      }
    } catch {
      setManual(null)
    }
    setLoading(false)
  }

  async function handleSign() {
    setSigning(true)
    try {
      const res = await fetch(`${API_BASE}/api/office-manual/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: PRACTICE_ID, userId: USER_ID }),
      })
      if (res.ok) {
        await loadManual()
        Alert.alert('Signed!', 'You have successfully signed the Office Manual.')
      } else {
        Alert.alert('Error', 'Failed to sign. Please try again.')
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.')
    } finally {
      setSigning(false)
    }
  }

  const mySig = manual?.signatures.find((s) => s.userId === USER_ID)

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Office Manual</Text>
        {manual && (
          <Text style={styles.headerSub}>v{manual.version} · Updated {fmtDate(manual.updatedAt)}</Text>
        )}
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1D9E75" size="large" />
        </View>
      ) : !manual ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No office manual has been published yet.</Text>
          <Text style={styles.emptySubText}>Check back with your manager.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Title */}
          <Text style={styles.manualTitle}>{manual.title}</Text>

          {/* Content */}
          <View style={styles.contentCard}>
            <Text style={styles.contentText}>{manual.content}</Text>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* Sticky bottom action */}
      {manual && (
        <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
          {mySig ? (
            <View style={styles.signedBadge}>
              <Text style={styles.signedText}>✓ Signed on {fmtDate(mySig.signedAt)}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.signBtn, signing && styles.signBtnDisabled]}
              onPress={handleSign}
              disabled={signing}
            >
              {signing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signBtnText}>
                  I have read and agree to the Office Manual
                </Text>
              )}
            </TouchableOpacity>
          )}
        </SafeAreaView>
      )}

      <BottomNav />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#555', textAlign: 'center' },
  emptySubText: { fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' },
  scroll: { padding: 16 },
  manualTitle: { fontSize: 22, fontWeight: '700', color: '#1D1D1B', marginBottom: 12 },
  contentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  contentText: { fontSize: 15, color: '#2C2C2A', lineHeight: 24 },
  bottomBar: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  signBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signBtnDisabled: { backgroundColor: '#9ECEC0' },
  signBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  signedBadge: {
    backgroundColor: '#E8F7F1',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signedText: { color: '#1D9E75', fontSize: 15, fontWeight: '700' },
})
