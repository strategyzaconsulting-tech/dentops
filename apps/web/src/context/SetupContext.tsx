
import React, { createContext, useContext, useState } from 'react'

export interface Doctor {
  id: string
  firstName: string
  lastName: string
  email: string
  specialty: string
}

export interface StaffMember {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

export interface Location {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
}

export interface SetupState {
  practice: {
    name: string
    type: string
    ownerName: string
    email: string
    phone: string
    tagline: string
  }
  logoFile: File | null
  logoPreviewUrl: string
  brandColor: string
  specialties: string[]
  doctors: Doctor[]
  staff: StaffMember[]
  locations: Location[]
}

interface SetupContextValue {
  state: SetupState
  setPractice: (practice: SetupState['practice']) => void
  setLogoFile: (file: File | null, previewUrl: string) => void
  setBrandColor: (color: string) => void
  setSpecialties: (specialties: string[]) => void
  setDoctors: (doctors: Doctor[]) => void
  setStaff: (staff: StaffMember[]) => void
  setLocations: (locations: Location[]) => void
}

const initialState: SetupState = {
  practice: {
    name: '',
    type: 'General Dentistry',
    ownerName: '',
    email: '',
    phone: '',
    tagline: '',
  },
  logoFile: null,
  logoPreviewUrl: '',
  brandColor: '#1D9E75',
  specialties: ['General Dentistry'],
  doctors: [],
  staff: [],
  locations: [],
}

const SetupContext = createContext<SetupContextValue | null>(null)

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SetupState>(initialState)

  const setPractice = (practice: SetupState['practice']) =>
    setState((s) => ({ ...s, practice }))

  const setLogoFile = (file: File | null, previewUrl: string) =>
    setState((s) => ({ ...s, logoFile: file, logoPreviewUrl: previewUrl }))

  const setBrandColor = (brandColor: string) =>
    setState((s) => ({ ...s, brandColor }))

  const setSpecialties = (specialties: string[]) =>
    setState((s) => ({ ...s, specialties }))

  const setDoctors = (doctors: Doctor[]) =>
    setState((s) => ({ ...s, doctors }))

  const setStaff = (staff: StaffMember[]) =>
    setState((s) => ({ ...s, staff }))

  const setLocations = (locations: Location[]) =>
    setState((s) => ({ ...s, locations }))

  return (
    <SetupContext.Provider
      value={{
        state,
        setPractice,
        setLogoFile,
        setBrandColor,
        setSpecialties,
        setDoctors,
        setStaff,
        setLocations,
      }}
    >
      {children}
    </SetupContext.Provider>
  )
}

export function useSetup(): SetupContextValue {
  const ctx = useContext(SetupContext)
  if (!ctx) throw new Error('useSetup must be used inside SetupProvider')
  return ctx
}
