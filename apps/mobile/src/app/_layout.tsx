import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '../lib/AuthContext'

export default function RootLayout() {
  return (
    <AuthProvider>
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
        <Stack.Screen name="hr-documents" options={{ headerShown: false }} />
        <Stack.Screen name="my-licenses" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  )
}
