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
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../lib/AuthContext'
import { apiFetch } from '../lib/api'

export default function ChangePasswordScreen() {
  const { onPasswordChanged } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!current || !next || !confirm) {
      setError('All fields are required.')
      return
    }
    if (next.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (next !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to change password' }))
        setError(err.error ?? 'Failed to change password')
        return
      }
      const data = await res.json()
      await onPasswordChanged(data.token)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>First Login</Text>
            </View>
            <Text style={styles.title}>Set your password</Text>
            <Text style={styles.subtitle}>
              Your account was created with a temporary password. Choose a new password to continue.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Temporary password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter temp password"
                placeholderTextColor="#9CA3AF"
                value={current}
                onChangeText={setCurrent}
                secureTextEntry
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 8 characters"
                placeholderTextColor="#9CA3AF"
                value={next}
                onChangeText={setNext}
                secureTextEntry
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter new password"
                placeholderTextColor="#9CA3AF"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Set password & continue</Text>
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
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  badge: {
    alignSelf: 'flex-start', backgroundColor: '#FEF3C7',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#92400E' },
  title: { fontSize: 19, fontWeight: '700', color: '#1A2E29', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 20 },
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
