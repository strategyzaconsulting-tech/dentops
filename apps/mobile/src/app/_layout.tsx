import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from '../lib/AuthContext'

function AuthGate() {
  const { user, loading, requirePasswordChange } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (loading) return
    const inAuth = segments[0] === 'login' || segments[0] === 'change-password'
    if (!user && !inAuth) {
      router.replace('/login')
    } else if (user && requirePasswordChange && segments[0] !== 'change-password') {
      router.replace('/change-password')
    } else if (user && !requirePasswordChange && inAuth) {
      router.replace('/')
    }
  }, [user, loading, requirePasswordChange, segments])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F0E8' }}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    )
  }

  return null
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="change-password" options={{ headerShown: false }} />
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
        <Stack.Screen name="hr-documents" options={{ headerShown: false }} />
        <Stack.Screen name="my-licenses" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  )
}
