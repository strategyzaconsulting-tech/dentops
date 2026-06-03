import { useEffect, useRef } from 'react'
import { Alert, Linking, Platform } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const USER_ID = '165234da-d643-41e8-8ec8-6e400d18a1d2'
const API_BASE = 'http://192.168.0.137:3000'

async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) {
    console.log('[Push] Skipped — physical device required')
    return
  }

  // Android 8+ requires a channel before any notification ops
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DentOps',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1D9E75',
    })
  }

  // Cast needed: expo-notifications types are pinned to a newer expo than this project uses
  type PermResult = { status: string; canAskAgain: boolean }
  const existing = await Notifications.getPermissionsAsync() as unknown as PermResult

  if (existing.status !== 'granted') {
    if (!existing.canAskAgain) {
      // iOS previously denied — must go to Settings to re-enable
      Alert.alert(
        'Notifications Disabled',
        'To receive alerts when requests are approved or denied, enable notifications for Expo Go in your device Settings.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      )
      return
    }

    const requested = await Notifications.requestPermissionsAsync() as unknown as PermResult
    if (requested.status !== 'granted') {
      console.log('[Push] Permission denied by user')
      return
    }
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    )
    console.log('[Push] Token:', token)

    await fetch(`${API_BASE}/api/users/push-token`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_ID, practiceId: PRACTICE_ID, token }),
    })
    console.log('[Push] Token registered with API')
  } catch (e) {
    // Common in Expo Go without an EAS project configured — harmless
    console.warn('[Push] Token registration failed:', e)
  }
}

export default function RootLayout() {
  const notifListener = useRef<Notifications.Subscription | null>(null)
  const responseListener = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    // Must be inside useEffect — calling at module level crashes Android
    // before the native notification module is ready
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })

    registerPushToken()

    notifListener.current = Notifications.addNotificationReceivedListener(() => {
      // Alert already shown by setNotificationHandler above
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      // Could navigate to /pto on tap in a future version
    })

    return () => {
      notifListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])

  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="pto" options={{ headerShown: false }} />
        <Stack.Screen name="time-clock" options={{ headerShown: false }} />
        <Stack.Screen name="open-shifts" options={{ headerShown: false }} />
        <Stack.Screen name="announcements" options={{ headerShown: false }} />
        <Stack.Screen name="benefits" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding-form" options={{ headerShown: false }} />
        <Stack.Screen name="office-manual" options={{ headerShown: false }} />
        <Stack.Screen name="training" options={{ headerShown: false }} />
        <Stack.Screen name="team-directory" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  )
}
