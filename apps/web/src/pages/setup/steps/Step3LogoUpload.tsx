import { useRef, useState, DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetup } from '../../../context/SetupContext'

export default function Step3LogoUpload() {
  const navigate = useNavigate()
  const { state, setLogoFile } = useSetup()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(state.logoPreviewUrl)
  const [fileName, setFileName] = useState(state.logoFile?.name ?? '')

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setFileName(file.name)
    setLogoFile(file, url)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleRemove = () => {
    setPreviewUrl('')
    setFileName('')
    setLogoFile(null, '')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleNext = () => navigate('/setup/brand-color')

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-[#2C2C2A] mb-1">
        Upload your practice logo
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        PNG or SVG recommended. Will be displayed in the app and staff portal.
      </p>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-[#1D9E75] bg-[#E1F5EE]'
            : 'border-gray-300 bg-[#F1EFE8] hover:border-[#1D9E75]'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {previewUrl ? (
          <div
            className="flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewUrl}
              alt="Logo preview"
              className="max-h-[120px] max-w-[240px] object-contain rounded"
            />
            <p className="text-sm text-gray-600">{fileName}</p>
            <button
              onClick={handleRemove}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mb-1">
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V4m0 0l-3 3m3-3l3 3"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-600 font-medium">
              Drop your logo here or{' '}
              <span className="text-[#1D9E75]">click to browse</span>
            </p>
            <p className="text-xs text-gray-400">PNG, SVG, JPG up to 5MB</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => navigate('/setup/practice-info')}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-4">
          {!previewUrl && (
            <button
              onClick={handleNext}
              className="text-sm text-[#1D9E75] hover:underline"
            >
              Skip for now →
            </button>
          )}
          <button
            onClick={handleNext}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#1D9E75' }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
