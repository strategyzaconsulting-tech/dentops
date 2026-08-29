import { useCallback, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { hasUnreadAnnouncements } from '../store/announcementStore'
import { timeClockHasBadge, openShiftsHasBadge, timeOffHasBadge } from '../store/navBadgeStore'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const TABS: { route: string; label: string; icon: IoniconName }[] = [
  { route: 'index',         label: 'Home',     icon: 'home-outline' },
  { route: 'time-clock',    label: 'Clock',    icon: 'time-outline' },
  { route: 'open-shifts',   label: 'Shifts',   icon: 'list-outline' },
  { route: 'pto',           label: 'Time Off', icon: 'sunny-outline' },
  { route: 'announcements', label: 'News',     icon: 'megaphone-outline' },
  { route: 'onboarding',   label: 'Profile',  icon: 'person-outline' },
]

type Route = 'index' | 'time-clock' | 'open-shifts' | 'pto' | 'announcements' | 'onboarding'

interface Props {
  activeRoute?: Route
}

export default function BottomNav({ activeRoute }: Props) {
  const { user } = useAuth()
  const practiceId = user?.practiceId ?? ''
  const userId = user?.id ?? ''

  const [annBadge, setAnnBadge] = useState(false)
  const [clockBadge, setClockBadge] = useState(false)
  const [shiftsBadge, setShiftsBadge] = useState(false)
  const [ptoBadge, setPtoBadge] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!practiceId || !userId) return
      Promise.allSettled([
        apiFetch(`/api/announcements?practiceId=${practiceId}`).then((r) => r.json()),
        apiFetch(`/api/clock-adjustments?practiceId=${practiceId}&userId=${userId}`).then((r) => r.json()),
        apiFetch(`/api/open-shifts?practiceId=${practiceId}&status=open`).then((r) => r.json()),
        apiFetch(`/api/pto/requests?practiceId=${practiceId}&userId=${userId}`).then((r) => r.json()),
      ]).then(([ann, adj, shifts, pto]) => {
        if (ann.status === 'fulfilled' && Array.isArray(ann.value)) setAnnBadge(hasUnreadAnnouncements(ann.value))
        if (adj.status === 'fulfilled' && Array.isArray(adj.value)) setClockBadge(timeClockHasBadge(adj.value))
        if (shifts.status === 'fulfilled' && Array.isArray(shifts.value)) setShiftsBadge(openShiftsHasBadge(shifts.value))
        if (pto.status === 'fulfilled' && Array.isArray(pto.value)) setPtoBadge(timeOffHasBadge(pto.value))
      })
    }, [practiceId, userId])
  )

  const badges: Record<Route, boolean> = {
    'index':         false,
    'time-clock':    clockBadge,
    'open-shifts':   shiftsBadge,
    'pto':           ptoBadge,
    'announcements': annBadge,
    'onboarding':    false,
  }

  return (
    <SafeAreaView style={styles.nav} edges={['bottom']}>
      <View style={styles.inner}>
        {TABS.map((tab) => {
          const isActive = activeRoute === tab.route
          const hasBadge = badges[tab.route as Route] ?? false
          const color = isActive ? '#1D9E75' : '#9A9A96'
          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.item}
              onPress={() =>
                tab.route === 'index'
                  ? router.replace('/')
                  : router.push(`/${tab.route}` as never)
              }
            >
              <View style={styles.iconWrap}>
                <Ionicons name={tab.icon} size={22} color={color} />
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
    backgroundColor: '#1E1E1C',
    borderTopWidth: 1,
    borderTopColor: '#2A2A27',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  inner: { flexDirection: 'row', paddingTop: 8, paddingBottom: 8 },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap: { position: 'relative' },
  label: { fontSize: 9, fontWeight: '300', color: '#9A9A96', letterSpacing: 2, textTransform: 'uppercase' },
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
