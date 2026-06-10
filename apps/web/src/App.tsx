import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SetupProvider } from './context/SetupContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import SetupWizard from './pages/setup/SetupWizard'
import Step1Welcome from './pages/setup/steps/Step1Welcome'
import Step2PracticeInfo from './pages/setup/steps/Step2PracticeInfo'
import Step3LogoUpload from './pages/setup/steps/Step3LogoUpload'
import Step4BrandColor from './pages/setup/steps/Step4BrandColor'
import Step5Specialties from './pages/setup/steps/Step5Specialties'
import Step6Doctors from './pages/setup/steps/Step6Doctors'
import Step7Staff from './pages/setup/steps/Step7Staff'
import Step8Locations from './pages/setup/steps/Step8Locations'
import Step9Launch from './pages/setup/steps/Step9Launch'
import Dashboard from './pages/Dashboard'
import TimeClock from './pages/TimeClock'
import PtoAdmin from './pages/PtoAdmin'
import Staff from './pages/Staff'
import Schedules from './pages/Schedules'
import OpenShifts from './pages/OpenShifts'
import Announcements from './pages/Announcements'
import Onboarding from './pages/Onboarding'
import Login from './pages/Login'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center"><div className="text-sm text-gray-400">Loading…</div></div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/time-clock" element={<RequireAuth><TimeClock /></RequireAuth>} />
          <Route path="/pto" element={<RequireAuth><PtoAdmin /></RequireAuth>} />
          <Route path="/staff" element={<RequireAuth><Staff /></RequireAuth>} />
          <Route path="/schedules" element={<RequireAuth><Schedules /></RequireAuth>} />
          <Route path="/open-shifts" element={<RequireAuth><OpenShifts /></RequireAuth>} />
          <Route path="/announcements" element={<RequireAuth><Announcements /></RequireAuth>} />
          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

          <Route
            path="/setup"
            element={
              <SetupProvider>
                <SetupWizard />
              </SetupProvider>
            }
          >
            <Route index element={<Navigate to="welcome" replace />} />
            <Route path="welcome" element={<Step1Welcome />} />
            <Route path="practice-info" element={<Step2PracticeInfo />} />
            <Route path="logo" element={<Step3LogoUpload />} />
            <Route path="brand-color" element={<Step4BrandColor />} />
            <Route path="specialties" element={<Step5Specialties />} />
            <Route path="doctors" element={<Step6Doctors />} />
            <Route path="staff" element={<Step7Staff />} />
            <Route path="locations" element={<Step8Locations />} />
            <Route path="launch" element={<Step9Launch />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
