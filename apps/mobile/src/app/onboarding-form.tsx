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
import * as WebBrowser from 'expo-web-browser'

function formatDob(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

const PDF_URLS: Partial<Record<FormType, string>> = {
  i9: 'https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf',
  w4: 'https://www.irs.gov/pub/irs-pdf/fw4.pdf',
}
const REQUIRES_SIGNATURE: FormType[] = ['i9', 'w4']

const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'
const USER_ID = '165234da-d643-41e8-8ec8-6e400d18a1d2'
const API_BASE = 'http://192.168.0.137:3000'

type FormType = 'i9' | 'w4' | 'personal-info' | 'emergency-contact' | 'direct-deposit'

const FIELD_LABELS: Partial<Record<FormType, Record<string, string>>> = {
  'i9': {
    lastName: 'Last Name', firstName: 'First Name', middleInitial: 'M.I.',
    otherLastNames: 'Other Last Names', address: 'Address', aptNumber: 'Apt #',
    city: 'City', state: 'State', zip: 'ZIP',
    dob: 'Date of Birth', ssn4: 'Last 4 SSN', email: 'Email', phone: 'Phone',
    citizenshipStatus: 'Citizenship Status', alienNumber: 'Alien/USCIS No.',
    i94Number: 'I-94 Number', foreignPassport: 'Foreign Passport', countryOfIssuance: 'Country of Issuance',
    workAuthExpiry: 'Work Auth Expiry',
    signatureName: 'Electronic Signature', signatureDate: 'Signed On',
  },
  'w4': {
    firstName: 'First Name & M.I.', lastName: 'Last Name', ssn4: 'Last 4 SSN',
    address: 'Address', city: 'City', state: 'State', zip: 'ZIP',
    filingStatus: 'Filing Status', multipleJobs: 'Multiple Jobs',
    qualifyingChildren: 'Qualifying Children ($)', otherDependents: 'Other Dependents ($)', totalDependents: 'Total Dependents ($)',
    otherIncome: 'Other Income ($)', deductions: 'Deductions ($)', extraWithholding: 'Extra Withholding ($)',
    signatureName: 'Electronic Signature', signatureDate: 'Signed On',
  },
  'personal-info': {
    firstName: 'First Name', lastName: 'Last Name',
    phone: 'Phone', email: 'Email Address', address: 'Home Address',
    city: 'City', state: 'State', zip: 'Zip',
    dob: 'Date of Birth', birthdayPrivacy: 'Birthday Preference',
  },
}

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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
      {children}
    </View>
  )
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={styles.input} placeholderTextColor="#bbb" {...props} />
}

function SectionHeader({ number, title, subtitle }: { number?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      {number && <Text style={styles.sectionHeaderNum}>{number}</Text>}
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionHeaderSub}>{subtitle}</Text>}
      </View>
    </View>
  )
}

// ─── Form components ──────────────────────────────────────────────────────────

function I9Form({ data, onChange }: { data: Record<string, string>; onChange: (k: string, v: string) => void }) {
  const status = data.citizenshipStatus ?? ''
  return (
    <>
      <SectionHeader
        title="Section 1. Employee Information and Attestation"
        subtitle="Complete and sign Section 1 as of your first day of employment."
      />

      {/* Name */}
      <View style={styles.row}>
        <View style={{ flex: 1.2 }}>
          <Field label="Last Name" required><Input value={data.lastName ?? ''} onChangeText={(v) => onChange('lastName', v)} placeholder="Doe" /></Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="First Name" required><Input value={data.firstName ?? ''} onChangeText={(v) => onChange('firstName', v)} placeholder="Jane" /></Field>
        </View>
        <View style={{ flex: 0.5 }}>
          <Field label="M.I."><Input value={data.middleInitial ?? ''} onChangeText={(v) => onChange('middleInitial', v)} placeholder="A" maxLength={1} autoCapitalize="characters" /></Field>
        </View>
      </View>
      <Field label="Other Last Names Used (if any)">
        <Input value={data.otherLastNames ?? ''} onChangeText={(v) => onChange('otherLastNames', v)} placeholder="N/A" />
      </Field>

      {/* Address */}
      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Field label="Street Address" required><Input value={data.address ?? ''} onChangeText={(v) => onChange('address', v)} placeholder="123 Main St" /></Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Apt. Number"><Input value={data.aptNumber ?? ''} onChangeText={(v) => onChange('aptNumber', v)} placeholder="4B" /></Field>
        </View>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 2 }}><Field label="City or Town" required><Input value={data.city ?? ''} onChangeText={(v) => onChange('city', v)} placeholder="New York" /></Field></View>
        <View style={{ flex: 1 }}><Field label="State" required><Input value={data.state ?? ''} onChangeText={(v) => onChange('state', v)} placeholder="NY" maxLength={2} autoCapitalize="characters" /></Field></View>
        <View style={{ flex: 1 }}><Field label="ZIP Code" required><Input value={data.zip ?? ''} onChangeText={(v) => onChange('zip', v)} placeholder="10001" keyboardType="number-pad" maxLength={5} /></Field></View>
      </View>

      {/* DOB + SSN + Contact */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Date of Birth" required><Input value={data.dob ?? ''} onChangeText={(v) => onChange('dob', formatDob(v))} placeholder="MM/DD/YYYY" keyboardType="number-pad" maxLength={10} /></Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Last 4 of SSN" required><Input value={data.ssn4 ?? ''} onChangeText={(v) => onChange('ssn4', v)} placeholder="1234" keyboardType="number-pad" maxLength={4} secureTextEntry /></Field>
        </View>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Email Address"><Input value={data.email ?? ''} onChangeText={(v) => onChange('email', v)} placeholder="jane@example.com" keyboardType="email-address" autoCapitalize="none" /></Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Phone Number"><Input value={data.phone ?? ''} onChangeText={(v) => onChange('phone', v)} placeholder="(212) 555-0100" keyboardType="phone-pad" /></Field>
        </View>
      </View>

      {/* Citizenship/Immigration Status */}
      <Field label="Citizenship / Immigration Status" required>
        <View style={{ gap: 8 }}>
          {[
            { val: 'us_citizen',              label: '1. A citizen of the United States' },
            { val: 'noncitizen_national',      label: '2. A noncitizen national of the United States' },
            { val: 'lawful_permanent_resident',label: '3. A lawful permanent resident' },
            { val: 'alien_authorized',         label: '4. An alien authorized to work' },
          ].map(({ val, label }) => (
            <TouchableOpacity
              key={val}
              style={[styles.radioRow, status === val && styles.radioRowSelected]}
              onPress={() => onChange('citizenshipStatus', val)}
              activeOpacity={0.7}
            >
              <View style={[styles.radioCircle, status === val && styles.radioCircleSelected]}>
                {status === val && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.radioLabel, status === val && styles.radioLabelSelected]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Field>

      {/* Conditional: Alien Registration Number */}
      {status === 'lawful_permanent_resident' && (
        <Field label="Alien Registration No. / USCIS Number" required>
          <Input value={data.alienNumber ?? ''} onChangeText={(v) => onChange('alienNumber', v)} placeholder="A-Number or USCIS Number" />
        </Field>
      )}
      {status === 'alien_authorized' && (
        <>
          <Field label="Work Authorization Expiry (MM/DD/YYYY or N/A)" required>
            <Input value={data.workAuthExpiry ?? ''} onChangeText={(v) => onChange('workAuthExpiry', v)} placeholder="MM/DD/YYYY or N/A" />
          </Field>
          <Text style={styles.noteText}>Provide ONE of the following:</Text>
          <Field label="Alien Registration No. / USCIS No.">
            <Input value={data.alienNumber ?? ''} onChangeText={(v) => onChange('alienNumber', v)} placeholder="A-Number" />
          </Field>
          <Field label="Form I-94 Admission Number">
            <Input value={data.i94Number ?? ''} onChangeText={(v) => onChange('i94Number', v)} placeholder="11 digits" keyboardType="number-pad" maxLength={11} />
          </Field>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Foreign Passport No.">
                <Input value={data.foreignPassport ?? ''} onChangeText={(v) => onChange('foreignPassport', v)} placeholder="Passport number" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Country of Issuance">
                <Input value={data.countryOfIssuance ?? ''} onChangeText={(v) => onChange('countryOfIssuance', v)} placeholder="e.g. Mexico" />
              </Field>
            </View>
          </View>
        </>
      )}
    </>
  )
}

function W4Form({ data, onChange }: { data: Record<string, unknown>; onChange: (k: string, v: unknown) => void }) {
  const str = (k: string) => (data[k] as string) ?? ''
  const filingStatus = str('filingStatus')

  return (
    <>
      {/* Step 1 */}
      <SectionHeader number="Step 1" title="Personal Information" />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="First Name & M.I." required><Input value={str('firstName')} onChangeText={(v) => onChange('firstName', v)} placeholder="Jane A." /></Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Last Name" required><Input value={str('lastName')} onChangeText={(v) => onChange('lastName', v)} placeholder="Doe" /></Field>
        </View>
      </View>
      <Field label="Social Security Number (last 4)" required>
        <Input value={str('ssn4')} onChangeText={(v) => onChange('ssn4', v)} placeholder="1234" keyboardType="number-pad" maxLength={4} secureTextEntry />
      </Field>
      <Field label="Home Address" required>
        <Input value={str('address')} onChangeText={(v) => onChange('address', v)} placeholder="123 Main St" />
      </Field>
      <View style={styles.row}>
        <View style={{ flex: 2 }}><Field label="City or Town" required><Input value={str('city')} onChangeText={(v) => onChange('city', v)} placeholder="New York" /></Field></View>
        <View style={{ flex: 1 }}><Field label="State" required><Input value={str('state')} onChangeText={(v) => onChange('state', v)} placeholder="NY" maxLength={2} autoCapitalize="characters" /></Field></View>
        <View style={{ flex: 1 }}><Field label="ZIP Code" required><Input value={str('zip')} onChangeText={(v) => onChange('zip', v)} placeholder="10001" keyboardType="number-pad" maxLength={5} /></Field></View>
      </View>
      <Field label="Filing Status" required>
        <View style={{ gap: 8 }}>
          {[
            { val: 'single_mfs', label: 'Single or Married filing separately' },
            { val: 'mfj',        label: 'Married filing jointly or Qualifying surviving spouse' },
            { val: 'hoh',        label: 'Head of household (single; pays more than half cost of home for self and dependents)' },
          ].map(({ val, label }) => (
            <TouchableOpacity
              key={val}
              style={[styles.radioRow, filingStatus === val && styles.radioRowSelected]}
              onPress={() => onChange('filingStatus', val)}
              activeOpacity={0.7}
            >
              <View style={[styles.radioCircle, filingStatus === val && styles.radioCircleSelected]}>
                {filingStatus === val && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.radioLabel, filingStatus === val && styles.radioLabelSelected]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Field>

      {/* Step 2 */}
      <SectionHeader number="Step 2" title="Multiple Jobs or Spouse Works" subtitle="Complete if you hold more than one job at a time, or are married filing jointly and your spouse also works." />
      <Field label="I have multiple jobs or my spouse works">
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleTitle, { flex: 1 }]}>
            {data.multipleJobs ? 'Yes — apply higher withholding rate' : 'No'}
          </Text>
          <Switch
            value={!!data.multipleJobs}
            onValueChange={(v) => onChange('multipleJobs', v)}
            trackColor={{ false: '#E0E0E0', true: '#1D9E75' }}
            thumbColor="#fff"
          />
        </View>
      </Field>

      {/* Step 3 */}
      <SectionHeader number="Step 3" title="Claim Dependents" subtitle="If your total income is $200,000 or less ($400,000 or less if MFJ)." />
      <Field label="Qualifying children under 17 (multiply × $2,000)">
        <Input value={str('qualifyingChildren')} onChangeText={(v) => onChange('qualifyingChildren', v)} placeholder="0" keyboardType="decimal-pad" />
      </Field>
      <Field label="Other dependents (multiply × $500)">
        <Input value={str('otherDependents')} onChangeText={(v) => onChange('otherDependents', v)} placeholder="0" keyboardType="decimal-pad" />
      </Field>
      <Field label="Total ($)">
        <Input value={str('totalDependents')} onChangeText={(v) => onChange('totalDependents', v)} placeholder="0.00" keyboardType="decimal-pad" />
      </Field>

      {/* Step 4 */}
      <SectionHeader number="Step 4" title="Other Adjustments (Optional)" />
      <Field label="Other income not from jobs ($)">
        <Input value={str('otherIncome')} onChangeText={(v) => onChange('otherIncome', v)} placeholder="0.00" keyboardType="decimal-pad" />
      </Field>
      <Field label="Deductions (from Deductions Worksheet) ($)">
        <Input value={str('deductions')} onChangeText={(v) => onChange('deductions', v)} placeholder="0.00" keyboardType="decimal-pad" />
      </Field>
      <Field label="Extra withholding per pay period ($)">
        <Input value={str('extraWithholding')} onChangeText={(v) => onChange('extraWithholding', v)} placeholder="0.00" keyboardType="decimal-pad" />
      </Field>
    </>
  )
}

function PersonalInfoForm({ data, onChange }: { data: Record<string, string>; onChange: (k: string, v: string) => void }) {
  return (
    <>
      <View style={styles.row}>
        <View style={{ flex: 1 }}><Field label="First Name"><Input value={data.firstName ?? ''} onChangeText={(v) => onChange('firstName', v)} placeholder="Jane" /></Field></View>
        <View style={{ flex: 1 }}><Field label="Last Name"><Input value={data.lastName ?? ''} onChangeText={(v) => onChange('lastName', v)} placeholder="Doe" /></Field></View>
      </View>
      <Field label="Phone"><Input value={data.phone ?? ''} onChangeText={(v) => onChange('phone', v)} placeholder="(212) 555-0100" keyboardType="phone-pad" /></Field>
      <Field label="Email Address"><Input value={data.email ?? ''} onChangeText={(v) => onChange('email', v)} placeholder="jane@example.com" keyboardType="email-address" autoCapitalize="none" /></Field>
      <Field label="Home Address"><Input value={data.address ?? ''} onChangeText={(v) => onChange('address', v)} placeholder="123 Main St" /></Field>
      <View style={styles.row}>
        <View style={{ flex: 2 }}><Field label="City"><Input value={data.city ?? ''} onChangeText={(v) => onChange('city', v)} placeholder="New York" /></Field></View>
        <View style={{ flex: 1 }}><Field label="State"><Input value={data.state ?? ''} onChangeText={(v) => onChange('state', v)} placeholder="NY" maxLength={2} autoCapitalize="characters" /></Field></View>
        <View style={{ flex: 1 }}><Field label="Zip"><Input value={data.zip ?? ''} onChangeText={(v) => onChange('zip', v)} placeholder="10001" keyboardType="number-pad" maxLength={5} /></Field></View>
      </View>
      <Field label="Date of Birth">
        <Input value={data.dob ?? ''} onChangeText={(v) => onChange('dob', formatDob(v))} placeholder="MM/DD/YYYY" keyboardType="number-pad" maxLength={10} />
      </Field>
      <Field label="Birthday Preference">
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>
              {data.birthdayPrivacy === 'private' ? '🔒 Keep private' : '🎉 Celebrate with the team'}
            </Text>
            <Text style={styles.toggleSub}>
              {data.birthdayPrivacy === 'private'
                ? 'Your birthday will not be shared with others'
                : 'Your team will be notified to wish you a happy birthday'}
            </Text>
          </View>
          <Switch
            value={data.birthdayPrivacy !== 'private'}
            onValueChange={(v) => onChange('birthdayPrivacy', v ? 'celebrated' : 'private')}
            trackColor={{ false: '#E0E0E0', true: '#1D9E75' }}
            thumbColor="#fff"
          />
        </View>
      </Field>
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
  const [signatureName, setSignatureName] = useState('')
  const [signatureAgreed, setSignatureAgreed] = useState(false)
  const needsSignature = REQUIRES_SIGNATURE.includes(formType)
  const isSigned = needsSignature ? (signatureName.trim().length > 2 && signatureAgreed) : true

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
        if (existing.signatureName) setSignatureName(existing.signatureName as string)
        setIsEditMode(false)
      } else {
        setExistingData(null)
        setFormData({})
        setSignatureName('')
        setSignatureAgreed(false)
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
    if (needsSignature && !isSigned) {
      Alert.alert('Signature Required', 'Please type your full legal name and check the agreement box before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const payload = needsSignature
        ? { ...formData, signatureName: signatureName.trim(), signatureDate: new Date().toISOString() }
        : formData
      const res = await fetch(
        `${API_BASE}/api/onboarding/forms?practiceId=${PRACTICE_ID}&userId=${USER_ID}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formType, data: payload }),
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
            {Object.entries(existingData).map(([k, v]) => {
              const labelMap = FIELD_LABELS[formType] ?? {}
              const label = labelMap[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
              const display = k === 'birthdayPrivacy' ? (v === 'private' ? '🔒 Keep private' : '🎉 Celebrate with team') : String(v)
              return (
                <View key={k} style={styles.readOnlyRow}>
                  <Text style={styles.readOnlyKey}>{label}</Text>
                  <Text style={styles.readOnlyValue}>{display}</Text>
                </View>
              )
            })}
          </View>
          {needsSignature && !!existingData?.signatureName && (
            <View style={[styles.signedBadge, { marginTop: 8 }]}>
              <Text style={styles.signedBadgeText}>✓ Electronically signed by {String(existingData.signatureName)}</Text>
            </View>
          )}
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

        {needsSignature && (
          <>
            <TouchableOpacity
              style={styles.pdfBtn}
              onPress={() => WebBrowser.openBrowserAsync(PDF_URLS[formType]!)}
            >
              <Text style={styles.pdfBtnText}>📄 View Official {formType === 'i9' ? 'I-9' : 'W-4'} Form (PDF)</Text>
            </TouchableOpacity>

            <View style={styles.signatureSection}>
              <Text style={styles.signatureLabel}>Electronic Signature</Text>
              <Text style={styles.signatureSub}>
                Type your full legal name exactly as it appears on your ID
              </Text>
              <Input
                value={signatureName}
                onChangeText={setSignatureName}
                placeholder="Full legal name"
                autoCapitalize="words"
              />

              <TouchableOpacity
                style={styles.agreementRow}
                onPress={() => setSignatureAgreed((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, signatureAgreed && styles.checkboxChecked]}>
                  {signatureAgreed && <Text style={styles.checkboxTick}>✓</Text>}
                </View>
                <Text style={styles.agreementText}>
                  I certify that the information I have provided is true and correct to the best of my knowledge, and I intend this to serve as my electronic signature.
                </Text>
              </TouchableOpacity>

              {isSigned && (
                <View style={styles.signedBadge}>
                  <Text style={styles.signedBadgeText}>✓ Ready to submit — signed by {signatureName.trim()}</Text>
                </View>
              )}
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isSigned) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isSigned}
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
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1D9E75',
    borderRadius: 10,
    paddingVertical: 13,
    marginBottom: 12,
    backgroundColor: '#F0FAF6',
  },
  pdfBtnText: { color: '#1D9E75', fontSize: 15, fontWeight: '600' },
  signatureSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 10,
  },
  signatureLabel: { fontSize: 13, fontWeight: '700', color: '#333', textTransform: 'uppercase', letterSpacing: 0.3 },
  signatureSub: { fontSize: 12, color: '#888' },
  agreementRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 2, borderColor: '#D0D0D0',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: '700' },
  agreementText: { flex: 1, fontSize: 12, color: '#555', lineHeight: 18 },
  signedBadge: {
    backgroundColor: '#E8F7F1',
    borderRadius: 8,
    padding: 12,
  },
  signedBadgeText: { color: '#1D9E75', fontWeight: '700', fontSize: 13 },
  sectionHeader: {
    backgroundColor: '#1D9E75',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    gap: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sectionHeaderNum: { color: '#fff', fontWeight: '800', fontSize: 12, marginRight: 8, marginTop: 1 },
  sectionHeaderTitle: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionHeaderSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 15, marginTop: 2 },
  required: { color: '#EF4444' },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  radioRowSelected: { borderColor: '#1D9E75', backgroundColor: '#F0FAF6' },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#C0C0C0',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  radioCircleSelected: { borderColor: '#1D9E75' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D9E75' },
  radioLabel: { flex: 1, fontSize: 13, color: '#444', lineHeight: 18 },
  radioLabelSelected: { color: '#1D9E75', fontWeight: '600' },
  noteText: { fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 4, marginTop: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FFFE',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8F5F0',
  },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: '#2C2C2A', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: '#888', lineHeight: 16 },
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
