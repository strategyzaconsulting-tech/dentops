import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const USER_ID = '165234da-d643-41e8-8ec8-6e400d18a1d2'
const API_BASE = 'http://192.168.0.137:3000'

type FormType = 'i9' | 'w4' | 'personal-info' | 'emergency-contact' | 'direct-deposit'

const FORM_TITLES: Record<FormType, string> = {
  'i9':                'I-9 Employment Eligibility',
  'w4':                'W-4 Withholding Certificate',
  'personal-info':     'Personal Information',
  'emergency-contact': 'Emergency Contact',
  'direct-deposit':    'Direct Deposit',
}

// ─── Chip helper ─────────────────────────────────────────────────────────────

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          onPress={() => onChange(opt)}
          style={[styles.chip, value === opt && styles.chipSelected]}
        >
          <Text style={[styles.chipText, value === opt && styles.chipTextSelected]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={styles.input} placeholderTextColor="#bbb" {...props} />
}

// ─── Form components ──────────────────────────────────────────────────────────

function I9Form({ data, onChange }: { data: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="First Name"><Input value={data.firstName ?? ''} onChangeText={(v) => onChange('firstName', v)} placeholder="Jane" /></Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Last Name"><Input value={data.lastName ?? ''} onChangeText={(v) => onChange('lastName', v)} placeholder="Doe" /></Field>
        </View>
      </View>
      <Field label="Street Address"><Input value={data.address ?? ''} onChangeText={(v) => onChange('address', v)} placeholder="123 Main St" /></Field>
      <View style={styles.row}>
        <View style={{ flex: 2 }}><Field label="City"><Input value={data.city ?? ''} onChangeText={(v) => onChange('city', v)} placeholder="New York" /></Field></View>
        <View style={{ flex: 1 }}><Field label="State"><Input value={data.state ?? ''} onChangeText={(v) => onChange('state', v)} placeholder="NY" maxLength={2} autoCapitalize="characters" /></Field></View>
        <View style={{ flex: 1 }}><Field label="Zip"><Input value={data.zip ?? ''} onChangeText={(v) => onChange('zip', v)} placeholder="10001" keyboardType="number-pad" maxLength={5} /></Field></View>
      </View>
      <Field label="Date of Birth (YYYY-MM-DD)"><Input value={data.dob ?? ''} onChangeText={(v) => onChange('dob', v)} placeholder="1990-01-15" keyboardType="number-pad" maxLength={10} /></Field>
      <Field label="Last 4 of SSN"><Input value={data.ssn4 ?? ''} onChangeText={(v) => onChange('ssn4', v)} placeholder="1234" keyboardType="number-pad" maxLength={4} secureTextEntry /></Field>
      <Field label="Citizenship Status">
        <Chips
          options={['US Citizen', 'Permanent Resident', 'Authorized Alien']}
          value={data.citizenshipStatus ?? ''}
          onChange={(v) => onChange('citizenshipStatus', v)}
        />
      </Field>
    </>
  )
}

function W4Form({ data, onChange }: { data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Filing Status">
        <Chips
          options={['Single', 'MFJ', 'MFS', 'HOH']}
          value={(data.filingStatus as string) ?? ''}
          onChange={(v) => onChange('filingStatus', v)}
        />
      </Field>
      <Field label="Has Multiple Jobs">
        <Switch
          value={!!data.hasMultipleJobs}
          onValueChange={(v) => onChange('hasMultipleJobs', v)}
          trackColor={{ true: '#1D9E75' }}
        />
      </Field>
      <Field label="Dependents Amount ($)">
        <Input
          value={(data.dependentsAmount as string) ?? ''}
          onChangeText={(v) => onChange('dependentsAmount', v)}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      </Field>
      <Field label="Extra Withholding ($)">
        <Input
          value={(data.extraWithholding as string) ?? ''}
          onChangeText={(v) => onChange('extraWithholding', v)}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      </Field>
    </>
  )
}

function PersonalInfoForm({ data, onChange }: { data: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Preferred Name"><Input value={data.preferredName ?? ''} onChangeText={(v) => onChange('preferredName', v)} placeholder="Jane" /></Field>
      <Field label="Phone"><Input value={data.phone ?? ''} onChangeText={(v) => onChange('phone', v)} placeholder="(212) 555-0100" keyboardType="phone-pad" /></Field>
      <Field label="Personal Email"><Input value={data.email ?? ''} onChangeText={(v) => onChange('email', v)} placeholder="jane@example.com" keyboardType="email-address" autoCapitalize="none" /></Field>
      <Field label="Street Address"><Input value={data.address ?? ''} onChangeText={(v) => onChange('address', v)} placeholder="123 Main St" /></Field>
      <View style={styles.row}>
        <View style={{ flex: 2 }}><Field label="City"><Input value={data.city ?? ''} onChangeText={(v) => onChange('city', v)} placeholder="New York" /></Field></View>
        <View style={{ flex: 1 }}><Field label="State"><Input value={data.state ?? ''} onChangeText={(v) => onChange('state', v)} placeholder="NY" maxLength={2} autoCapitalize="characters" /></Field></View>
        <View style={{ flex: 1 }}><Field label="Zip"><Input value={data.zip ?? ''} onChangeText={(v) => onChange('zip', v)} placeholder="10001" keyboardType="number-pad" maxLength={5} /></Field></View>
      </View>
    </>
  )
}

function EmergencyContactForm({ data, onChange }: { data: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Contact Name"><Input value={data.name ?? ''} onChangeText={(v) => onChange('name', v)} placeholder="Full Name" /></Field>
      <Field label="Relationship"><Input value={data.relationship ?? ''} onChangeText={(v) => onChange('relationship', v)} placeholder="Spouse, Parent, etc." /></Field>
      <Field label="Primary Phone"><Input value={data.primaryPhone ?? ''} onChangeText={(v) => onChange('primaryPhone', v)} placeholder="(212) 555-0100" keyboardType="phone-pad" /></Field>
      <Field label="Alternate Phone"><Input value={data.altPhone ?? ''} onChangeText={(v) => onChange('altPhone', v)} placeholder="(212) 555-0200" keyboardType="phone-pad" /></Field>
    </>
  )
}

function DirectDepositForm({ data, onChange }: { data: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Bank Name"><Input value={data.bankName ?? ''} onChangeText={(v) => onChange('bankName', v)} placeholder="Chase, Wells Fargo, etc." /></Field>
      <Field label="Account Type">
        <Chips
          options={['Checking', 'Savings']}
          value={data.accountType ?? ''}
          onChange={(v) => onChange('accountType', v)}
        />
      </Field>
      <Field label="Routing Number (9 digits)">
        <Input
          value={data.routingNumber ?? ''}
          onChangeText={(v) => onChange('routingNumber', v)}
          placeholder="123456789"
          keyboardType="number-pad"
          maxLength={9}
          secureTextEntry
        />
      </Field>
      <Field label="Account Number">
        <Input
          value={data.accountNumber ?? ''}
          onChangeText={(v) => onChange('accountNumber', v)}
          placeholder="Account number"
          keyboardType="number-pad"
          secureTextEntry
        />
      </Field>
    </>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OnboardingFormScreen() {
  const { type } = useLocalSearchParams<{ type: FormType }>()
  const formType = (type as FormType) ?? 'i9'

  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [existingData, setExistingData] = useState<Record<string, unknown> | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      loadExisting()
    }, [formType])
  )

  async function loadExisting() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/onboarding?practiceId=${PRACTICE_ID}&userId=${USER_ID}`)
      const data = await res.json()
      const fieldMap: Record<FormType, string> = {
        'i9': 'i9Data',
        'w4': 'w4Data',
        'personal-info': 'personalInfoData',
        'emergency-contact': 'emergencyContactData',
        'direct-deposit': 'directDepositData',
      }
      const existing = data[fieldMap[formType]]
      if (existing) {
        setExistingData(existing)
        setFormData(existing)
        setIsEditMode(false)
      } else {
        setExistingData(null)
        setFormData({})
        setIsEditMode(true)
      }
    } catch {
      setIsEditMode(true)
    }
    setLoading(false)
  }

  function updateField(key: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/onboarding/forms?practiceId=${PRACTICE_ID}&userId=${USER_ID}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formType, data: formData }),
        }
      )
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          router.back()
        }, 1500)
      } else {
        Alert.alert('Error', 'Failed to save form. Please try again.')
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const title = FORM_TITLES[formType] ?? 'Form'

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.header} edges={['top']}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </SafeAreaView>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#1D9E75" size="large" />
        </View>
      </View>
    )
  }

  // Read-only view
  if (existingData && !isEditMode) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.header} edges={['top']}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.submittedBadge}>
            <Text style={styles.submittedText}>✓ Submitted</Text>
          </View>
          <View style={styles.card}>
            {Object.entries(existingData).map(([k, v]) => (
              <View key={k} style={styles.readOnlyRow}>
                <Text style={styles.readOnlyKey}>{k}</Text>
                <Text style={styles.readOnlyValue}>{String(v)}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditMode(true)}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  // Success state
  if (success) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 48 }}>✅</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1D9E75', marginTop: 12 }}>Saved!</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {formType === 'i9' && (
            <I9Form
              data={formData as Record<string, string>}
              onChange={updateField}
            />
          )}
          {formType === 'w4' && (
            <W4Form
              data={formData}
              onChange={updateField}
            />
          )}
          {formType === 'personal-info' && (
            <PersonalInfoForm
              data={formData as Record<string, string>}
              onChange={updateField}
            />
          )}
          {formType === 'emergency-contact' && (
            <EmergencyContactForm
              data={formData as Record<string, string>}
              onChange={updateField}
            />
          )}
          {formType === 'direct-deposit' && (
            <DirectDepositForm
              data={formData as Record<string, string>}
              onChange={updateField}
            />
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
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
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  scroll: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  row: { flexDirection: 'row', gap: 10 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#2C2C2A',
    backgroundColor: '#FAFAFA',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipSelected: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  submitBtnDisabled: { backgroundColor: '#9ECEC0' },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  submittedBadge: {
    backgroundColor: '#E8F7F1',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submittedText: { color: '#1D9E75', fontWeight: '700', fontSize: 15 },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  readOnlyKey: { fontSize: 13, color: '#888', fontWeight: '500', textTransform: 'capitalize' },
  readOnlyValue: { fontSize: 13, color: '#2C2C2A', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  editBtn: {
    borderWidth: 1.5,
    borderColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  editBtnText: { color: '#1D9E75', fontSize: 16, fontWeight: '600' },
})
