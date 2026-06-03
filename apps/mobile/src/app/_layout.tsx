import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  useEffect(() => {
    // Push notifications are set up silently — any version mismatch is non-fatal
    void (async () => {
      try {
        const Notifications = await import('expo-notifications')
        const Device = await import('expo-device')
        const { default: Constants } = await import('expo-constants')

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        })

        if (!Device.isDevice) return

        const { status } = await Notifications.getPermissionsAsync() as { status: string; canAskAgain: boolean }
        if (status !== 'granted') {
          const { status: asked } = await Notifications.requestPermissionsAsync() as { status: string }
          if (asked !== 'granted') return
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
        const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)

        await fetch('http://192.168.0.137:3000/api/users/push-token', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: '165234da-d643-41e8-8ec8-6e400d18a1d2',
            practiceId: 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357',
            token,
          }),
        })
      } catch {
        // expo-notifications unavailable or version mismatch — app continues normally
      }
    })()
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
