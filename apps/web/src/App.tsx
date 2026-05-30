import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SetupProvider } from './context/SetupContext'
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/time-clock" element={<TimeClock />} />
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
    </BrowserRouter>
  )
}
