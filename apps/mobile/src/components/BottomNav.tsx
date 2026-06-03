import { useCallback, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { hasUnreadAnnouncements } from '../store/announcementStore'
import { timeClockHasBadge, openShiftsHasBadge, timeOffHasBadge } from '../store/navBadgeStore'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const USER_ID = '165234da-d643-41e8-8ec8-6e400d18a1d2'
const API_BASE = 'http://192.168.0.137:3000'

const TABS = [
  { route: 'time-clock',    label: 'Clock',    icon: '🕐' },
  { route: 'open-shifts',   label: 'Shifts',   icon: '📋' },
  { route: 'pto',           label: 'Time Off',  icon: '📅' },
  { route: 'announcements', label: 'News',     icon: '📢' },
  { route: 'benefits',      label: 'Benefits', icon: '🏥' },
  { route: 'onboarding',    label: 'Profile',  icon: '👤' },
] as const

type Route = typeof TABS[number]['route']

interface Props {
  activeRoute?: Route
}

export default function BottomNav({ activeRoute }: Props) {
  const [annBadge, setAnnBadge] = useState(false)
  const [clockBadge, setClockBadge] = useState(false)
  const [shiftsBadge, setShiftsBadge] = useState(false)
  const [ptoBadge, setPtoBadge] = useState(false)

  useFocusEffect(
    useCallback(() => {
      Promise.allSettled([
        fetch(`${API_BASE}/api/announcements?practiceId=${PRACTICE_ID}`).then((r) => r.json()),
        fetch(`${API_BASE}/api/clock-adjustments?practiceId=${PRACTICE_ID}&userId=${USER_ID}`).then((r) => r.json()),
        fetch(`${API_BASE}/api/open-shifts?practiceId=${PRACTICE_ID}&status=open`).then((r) => r.json()),
        fetch(`${API_BASE}/api/pto/requests?practiceId=${PRACTICE_ID}&userId=${USER_ID}`).then((r) => r.json()),
      ]).then(([ann, adj, shifts, pto]) => {
        if (ann.status === 'fulfilled' && Array.isArray(ann.value)) setAnnBadge(hasUnreadAnnouncements(ann.value))
        if (adj.status === 'fulfilled' && Array.isArray(adj.value)) setClockBadge(timeClockHasBadge(adj.value))
        if (shifts.status === 'fulfilled' && Array.isArray(shifts.value)) setShiftsBadge(openShiftsHasBadge(shifts.value))
        if (pto.status === 'fulfilled' && Array.isArray(pto.value)) setPtoBadge(timeOffHasBadge(pto.value))
      })
    }, [])
  )

  const badges: Record<Route, boolean> = {
    'time-clock': clockBadge,
    'open-shifts': shiftsBadge,
    'pto': ptoBadge,
    'announcements': annBadge,
    'benefits': false,
    'onboarding': false,
  }

  return (
    <SafeAreaView style={styles.nav} edges={['bottom']}>
      <View style={styles.inner}>
        {TABS.map((tab) => {
          const isActive = activeRoute === tab.route
          const hasBadge = badges[tab.route]
          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.item}
              onPress={() => router.push(`/${tab.route}` as never)}
            >
              <View style={styles.iconWrap}>
                <Text style={styles.icon}>{tab.icon}</Text>
                {hasBadge && <View style={styles.badgeDot} />}
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  nav: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D8D8D8',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  inner: { flexDirection: 'row', paddingTop: 8, paddingBottom: 8 },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap: { position: 'relative' },
  icon: { fontSize: 20 },
  label: { fontSize: 10, fontWeight: '600', color: '#555', letterSpacing: 0.1 },
  labelActive: { color: '#1D9E75' },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
})
