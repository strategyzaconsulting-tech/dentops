import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../lib/AuthContext'

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Svg width={64} height={64} viewBox="0 0 44 44" style={styles.logoMark}>
              <Rect width="44" height="44" rx="10" fill="#1E2E2A" />
              <Path d="M8 16 Q15 11 22 16 Q29 21 36 16" stroke="#A8D5E2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <Path d="M8 22 Q16 16 24 22 Q30 26 36 22" stroke="#5BA4BE" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <Path d="M8 28 Q14 23 20 28 Q28 34 36 28" stroke="#8BAF9A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </Svg>
            <Text style={styles.appName}>BRISA</Text>
            <Text style={styles.tagline}>Staff Portal</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Sign in</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E8' },
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoMark: { marginBottom: 12 },
  appName: { fontSize: 26, fontWeight: '700', color: '#1A2E29', letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 24, shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#1A2E29', marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA',
  },
  error: { fontSize: 13, color: '#DC2626', marginBottom: 12 },
  button: {
    backgroundColor: '#1D9E75', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
