import { useCallback, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import BottomNav from '../components/BottomNav'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const LICENSE_TYPES = [
  { key: 'dental_license',   label: 'Dental License',        hasState: true  },
  { key: 'da_certification', label: 'DA Certification',      hasState: true  },
  { key: 'rdh_license',      label: 'RDH License',           hasState: true  },
  { key: 'dea',              label: 'DEA Number',            hasState: false },
  { key: 'caqh',             label: 'CAQH Number',           hasState: false },
  { key: 'npi',              label: 'NPI Number',            hasState: false },
  { key: 'cpr',              label: 'CPR / BLS Card',        hasState: false },
  { key: 'xray',             label: 'X-Ray Certificate',     hasState: true  },
  { key: 'malpractice',      label: 'Malpractice Insurance', hasState: false },
  { key: 'other',            label: 'Other',                 hasState: true  },
]

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface License {
  id: string
  type: string
  label: string | null
  licenseNumber: string | null
  state: string | null
  issuedDate: string | null
  expirationDate: string | null
  notes: string | null
  alertDays: number
  insuranceCarrier: string | null
  coverageAmount: string | null
}

interface FormState {
  type: string
  customLabel: string
  licenseNumber: string
  state: string
  issuedDate: string
  expirationDate: string
  notes: string
  photoUri: string | null
  photoBase64: string | null
  photoMime: string
  photoName: string
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtDate(iso: string) {
  const d = new Date(iso.split('T')[0] + 'T12:00:00')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}-${d.getFullYear()}`
}

function toIsoDate(mmddyyyy: string): string {
  const [mm, dd, yyyy] = mmddyyyy.split('-')
  if (mm && dd && yyyy && yyyy.length === 4) return `${yyyy}-${mm}-${dd}`
  return mmddyyyy
}

function licStatus(exp: string | null, alertDays: number) {
  if (!exp) return 'none'
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(exp.split('T')[0] + 'T12:00:00')
  const days = Math.ceil((d.getTime() - today.getTime()) / 86400000)
  if (days < 0) return 'expired'
  if (days <= alertDays) return 'expiring'
  return 'active'
}

function daysLeft(exp: string | null) {
  if (!exp) return null
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.ceil((new Date(exp.split('T')[0] + 'T12:00:00').getTime() - today.getTime()) / 86400000)
}

const STATUS_CFG = {
  expired:  { label: 'Expired',       color: '#EF4444', bg: '#FEE2E2', dot: '#EF4444' },
  expiring: { label: 'Expiring Soon', color: '#D97706', bg: '#FEF3C7', dot: '#F59E0B' },
  active:   { label: 'Active',        color: '#059669', bg: '#D1FAE5', dot: '#10B981' },
  none:     { label: 'No Expiry',     color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' },
}

const emptyForm = (): FormState => ({
  type: 'dental_license',
  customLabel: '',
  licenseNumber: '',
  state: '',
  issuedDate: '',
  expirationDate: '',
  notes: '',
  photoUri: null,
  photoBase64: null,
  photoMime: 'image/jpeg',
  photoName: 'license.jpg',
})

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function MyLicensesScreen() {
  const { user } = useAuth()
  const practiceId = user?.practiceId ?? ''
  const userId = user?.id ?? ''

  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [showStatePicker, setShowStatePicker] = useState(false)

  const selectedType = LICENSE_TYPES.find(t => t.key === form.type)

  useFocusEffect(useCallback(() => { if (userId) load() }, [userId]))

  async function load() {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/licenses?userId=${userId}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        const order = { expired: 0, expiring: 1, active: 2, none: 3 }
        setLicenses([...data].sort((a, b) =>
          (order[licStatus(a.expirationDate, a.alertDays)] ?? 4) -
          (order[licStatus(b.expirationDate, b.alertDays)] ?? 4)
        ))
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  // â”€â”€ Photo capture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to attach a license image.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setForm(f => ({
        ...f,
        photoUri: asset.uri,
        photoBase64: asset.base64 ?? null,
        photoMime: asset.mimeType ?? 'image/jpeg',
        photoName: asset.fileName ?? 'license.jpg',
      }))
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to photograph your license.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setForm(f => ({
        ...f,
        photoUri: asset.uri,
        photoBase64: asset.base64 ?? null,
        photoMime: asset.mimeType ?? 'image/jpeg',
        photoName: asset.fileName ?? 'license_photo.jpg',
      }))
    }
  }

  function showPhotoOptions() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (i) => { if (i === 1) takePhoto(); else if (i === 2) pickPhoto() }
      )
    } else {
      Alert.alert('Add Photo', 'Choose an option', [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickPhoto },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }

  // â”€â”€ Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handleSave() {
    if (!form.type) return
    setSaving(true)
    try {
      // 1. Create the license record
      const licRes = await apiFetch('/api/licenses', {
        method: 'POST',
        body: JSON.stringify({
          userId: userId,
          practiceId: practiceId,
          type: form.type,
          label: form.type === 'other' ? (form.customLabel.trim() || null) : null,
          licenseNumber: form.licenseNumber.trim() || null,
          state: form.state || null,
          issuedDate: form.issuedDate ? toIsoDate(form.issuedDate) : null,
          expirationDate: form.expirationDate ? toIsoDate(form.expirationDate) : null,
          notes: form.notes.trim() || null,
          alertDays: 30,
        }),
      })

      if (!licRes.ok) {
        Alert.alert('Error', 'Could not save license. Please try again.')
        return
      }

      const lic = await licRes.json()

      // 2. Upload photo if one was taken
      if (form.photoBase64) {
        await apiFetch('/api/license-documents', {
          method: 'POST',
          body: JSON.stringify({
            licenseId: lic.id,
            userId: userId,
            fileName: form.photoName,
            mimeType: form.photoMime,
            fileDataBase64: form.photoBase64,
          }),
        })
      }

      setShowAdd(false)
      setForm(emptyForm())
      await load()
      Alert.alert('Saved', 'Your license has been added successfully.')
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const expiring = licenses.filter(l => {
    const st = licStatus(l.expirationDate, l.alertDays)
    return st === 'expired' || st === 'expiring'
  }).length

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>My Licenses</Text>
        {expiring > 0 && (
          <View style={s.badge}><Text style={s.badgeText}>{expiring}</Text></View>
        )}
        <TouchableOpacity style={s.addBtn} onPress={() => { setForm(emptyForm()); setShowAdd(true) }}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#1D9E75" size="large" /></View>
      ) : licenses.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🪪</Text>
          <Text style={s.empty}>No licenses on file</Text>
          <Text style={s.emptySub}>Tap + Add to upload your first certification</Text>
          <TouchableOpacity style={s.emptyAddBtn} onPress={() => { setForm(emptyForm()); setShowAdd(true) }}>
            <Text style={s.emptyAddBtnText}>+ Add License</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {expiring > 0 && (
            <View style={s.alertBanner}>
              <Text style={s.alertText}>⚠ {expiring} license{expiring > 1 ? 's' : ''} need{expiring === 1 ? 's' : ''} attention</Text>
            </View>
          )}
          {licenses.map(lic => {
            const st = licStatus(lic.expirationDate, lic.alertDays)
            const cfg = STATUS_CFG[st]
            const dl = daysLeft(lic.expirationDate)
            const label = lic.label ?? LICENSE_TYPES.find(t => t.key === lic.type)?.label ?? lic.type
            return (
              <View key={lic.id} style={s.card}>
                <View style={[s.cardAccent, { backgroundColor: cfg.dot }]} />
                <View style={s.cardBody}>
                  <View style={s.cardTop}>
                    <Text style={s.licLabel} numberOfLines={1}>{label}</Text>
                    {lic.state && <Text style={s.statePill}>{lic.state}</Text>}
                    <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.statusText, { color: cfg.color }]}>
                        {st === 'expiring' && dl !== null
                          ? `${dl}d left`
                          : st === 'expired' && dl !== null
                          ? `${Math.abs(dl)}d expired`
                          : cfg.label}
                      </Text>
                    </View>
                  </View>
                  {lic.type === 'malpractice' && lic.insuranceCarrier && (
                    <Text style={s.meta}>{lic.insuranceCarrier}</Text>
                  )}
                  {lic.licenseNumber && <Text style={s.licNum}>{lic.licenseNumber}</Text>}
                  <View style={s.dates}>
                    {lic.issuedDate && <Text style={s.dateText}>Issued {fmtDate(lic.issuedDate)}</Text>}
                    {lic.expirationDate && (
                      <Text style={[s.dateText, (st === 'expired' || st === 'expiring') && { color: cfg.color, fontWeight: '600' }]}>
                        Exp {fmtDate(lic.expirationDate)}
                      </Text>
                    )}
                  </View>
                  {lic.notes && <Text style={s.notes}>{lic.notes}</Text>}
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}

      <BottomNav activeRoute="onboarding" />

      {/* â”€â”€ Add License Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Add License</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !form.type}
              style={[s.modalSave, (saving || !form.type) && s.modalSaveDis]}
            >
              <Text style={s.modalSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">

            {/* Photo section — camera/gallery at top */}
            <View style={s.photoSection}>
              {form.photoUri ? (
                <View style={s.photoPreviewWrap}>
                  <Image source={{ uri: form.photoUri }} style={s.photoPreview} resizeMode="cover" />
                  <TouchableOpacity style={s.photoChange} onPress={showPhotoOptions}>
                    <Text style={s.photoChangeText}>Change Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.photoPlaceholder} onPress={showPhotoOptions}>
                  <Text style={s.photoIcon}>📷</Text>
                  <Text style={s.photoLabel}>Scan or Photo</Text>
                  <Text style={s.photoSub}>Take a photo or choose from library</Text>
                </TouchableOpacity>
              )}
              <View style={s.photoBtns}>
                <TouchableOpacity style={s.photoBtn} onPress={takePhoto}>
                  <Text style={s.photoBtnIcon}>📷</Text>
                  <Text style={s.photoBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.photoBtn} onPress={pickPhoto}>
                  <Text style={s.photoBtnIcon}>🖼</Text>
                  <Text style={s.photoBtnText}>Library</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* License type */}
            <View style={s.field}>
              <Text style={s.label}>License type <Text style={s.req}>*</Text></Text>
              <TouchableOpacity style={s.picker} onPress={() => setShowTypePicker(true)}>
                <Text style={s.pickerText}>{selectedType?.label ?? 'Select type…'}</Text>
                <Text style={s.pickerChev}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Custom label for "other" */}
            {form.type === 'other' && (
              <View style={s.field}>
                <Text style={s.label}>Custom name</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Laser Certification"
                  value={form.customLabel}
                  onChangeText={v => setForm(f => ({ ...f, customLabel: v }))}
                />
              </View>
            )}

            {/* License / cert number */}
            <View style={s.field}>
              <Text style={s.label}>
                {form.type === 'caqh' ? 'CAQH Number'
                  : form.type === 'dea' ? 'DEA Number'
                  : form.type === 'npi' ? 'NPI Number'
                  : form.type === 'malpractice' ? 'Policy number'
                  : 'License / certificate number'}
                <Text style={s.optional}> (optional)</Text>
              </Text>
              <TextInput
                style={[s.input, s.monoInput]}
                placeholder="e.g. RDH-NY-12345"
                value={form.licenseNumber}
                onChangeText={v => setForm(f => ({ ...f, licenseNumber: v }))}
                autoCapitalize="characters"
              />
            </View>

            {/* State — only for state-specific types */}
            {selectedType?.hasState && (
              <View style={s.field}>
                <Text style={s.label}>State<Text style={s.optional}> (optional)</Text></Text>
                <TouchableOpacity style={s.picker} onPress={() => setShowStatePicker(true)}>
                  <Text style={[s.pickerText, !form.state && { color: '#9CA3AF' }]}>
                    {form.state || 'Not state-specific'}
                  </Text>
                  <Text style={s.pickerChev}>›</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Issue date */}
            <View style={s.field}>
              <Text style={s.label}>Issue date<Text style={s.optional}> (optional)</Text></Text>
              <TextInput
                style={s.input}
                placeholder="MM-DD-YYYY"
                value={form.issuedDate}
                onChangeText={v => setForm(f => ({ ...f, issuedDate: v }))}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>

            {/* Expiry date */}
            <View style={s.field}>
              <Text style={s.label}>Expiration date<Text style={s.optional}> (optional)</Text></Text>
              <TextInput
                style={s.input}
                placeholder="MM-DD-YYYY"
                value={form.expirationDate}
                onChangeText={v => setForm(f => ({ ...f, expirationDate: v }))}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>

            {/* Notes */}
            <View style={s.field}>
              <Text style={s.label}>Notes<Text style={s.optional}> (optional)</Text></Text>
              <TextInput
                style={[s.input, { height: 72, textAlignVertical: 'top' }]}
                placeholder="e.g. Renewal in progress"
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                multiline
              />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Type picker sheet */}
          <Modal visible={showTypePicker} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={s.safe}>
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>License Type</Text>
                <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                  <Text style={s.sheetDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {LICENSE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.sheetRow, form.type === t.key && s.sheetRowSelected]}
                    onPress={() => { setForm(f => ({ ...f, type: t.key })); setShowTypePicker(false) }}
                  >
                    <Text style={[s.sheetRowText, form.type === t.key && s.sheetRowTextSelected]}>{t.label}</Text>
                    {form.type === t.key && <Text style={s.sheetCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </SafeAreaView>
          </Modal>

          {/* State picker sheet */}
          <Modal visible={showStatePicker} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={s.safe}>
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>State</Text>
                <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                  <Text style={s.sheetDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                <TouchableOpacity
                  style={[s.sheetRow, !form.state && s.sheetRowSelected]}
                  onPress={() => { setForm(f => ({ ...f, state: '' })); setShowStatePicker(false) }}
                >
                  <Text style={[s.sheetRowText, !form.state && s.sheetRowTextSelected]}>Not state-specific</Text>
                  {!form.state && <Text style={s.sheetCheck}>✓</Text>}
                </TouchableOpacity>
                {US_STATES.map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[s.sheetRow, form.state === st && s.sheetRowSelected]}
                    onPress={() => { setForm(f => ({ ...f, state: st })); setShowStatePicker(false) }}
                  >
                    <Text style={[s.sheetRowText, form.state === st && s.sheetRowTextSelected]}>{st}</Text>
                    {form.state === st && <Text style={s.sheetCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E8' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#2C3E3A' },
  back: { color: '#8BAF9A', fontSize: 14 },
  title: { flex: 1, color: '#FAF6EF', fontSize: 17, fontWeight: '700' },
  badge: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addBtn: { backgroundColor: '#1D9E75', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  empty: { color: '#374151', fontSize: 17, fontWeight: '600' },
  emptySub: { color: '#9CA3AF', fontSize: 13, textAlign: 'center' },
  emptyAddBtn: { marginTop: 8, backgroundColor: '#1D9E75', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyAddBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  list: { padding: 16, gap: 10 },
  alertBanner: { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 4 },
  alertText: { color: '#92400E', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: 14, gap: 5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  licLabel: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  statePill: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, fontSize: 11, color: '#6B7280', fontWeight: '600' },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, color: '#374151', fontWeight: '500' },
  licNum: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 12, color: '#6B7280', letterSpacing: 0.5 },
  dates: { flexDirection: 'row', gap: 12 },
  dateText: { fontSize: 12, color: '#6B7280' },
  notes: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  // Modal
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalCancel: { color: '#6B7280', fontSize: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalSave: { backgroundColor: '#1D9E75', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  modalSaveDis: { opacity: 0.4 },
  modalSaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  formScroll: { padding: 20, gap: 4 },
  // Photo section
  photoSection: { marginBottom: 20 },
  photoPlaceholder: { height: 160, backgroundColor: '#fff', borderRadius: 14, borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  photoIcon: { fontSize: 36 },
  photoLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  photoSub: { fontSize: 12, color: '#9CA3AF' },
  photoPreviewWrap: { marginBottom: 12, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  photoPreview: { width: '100%', height: 200, borderRadius: 14 },
  photoChange: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  photoChangeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  photoBtns: { flexDirection: 'row', gap: 10 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  photoBtnIcon: { fontSize: 18 },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  // Form fields
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  req: { color: '#EF4444' },
  optional: { color: '#9CA3AF', fontWeight: '400' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  monoInput: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 0.5 },
  picker: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText: { fontSize: 15, color: '#111827' },
  pickerChev: { fontSize: 18, color: '#9CA3AF' },
  // Picker sheets
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#fff' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  sheetDone: { color: '#1D9E75', fontSize: 16, fontWeight: '600' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', backgroundColor: '#fff' },
  sheetRowSelected: { backgroundColor: '#F0FDF9' },
  sheetRowText: { fontSize: 16, color: '#111827' },
  sheetRowTextSelected: { color: '#1D9E75', fontWeight: '600' },
  sheetCheck: { color: '#1D9E75', fontSize: 18, fontWeight: '700' },
})
