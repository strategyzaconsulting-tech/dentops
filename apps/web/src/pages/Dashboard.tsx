// ─── Illustrations ────────────────────────────────────────────────────────────

function StaffIllustration() {
  return (
    <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
      {/* Three people */}
      {[{ cx: 28, cy: 22, r: 11, body: [17, 38, 22, 56], color: '#1D9E75' },
        { cx: 44, cy: 18, r: 13, body: [31, 36, 26, 56], color: '#059669' },
        { cx: 60, cy: 22, r: 11, body: [49, 38, 22, 56], color: '#34D399' },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={p.r} fill={p.color} opacity={i === 1 ? 1 : 0.75} />
          <rect x={p.body[0]} y={p.body[1]} width={p.body[2]} height={p.body[3]} rx="6" fill={p.color} opacity={i === 1 ? 0.9 : 0.6} />
        </g>
      ))}
      {/* ID badge on center person */}
      <rect x="38" y="44" width="12" height="9" rx="2" fill="white" opacity="0.9" />
      <line x1="42" y1="47" x2="46" y2="47" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="42" y1="50" x2="46" y2="50" stroke="#1D9E75" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function SchedulesIllustration() {
  const days = ['M','T','W','T','F']
  const blocks = [
    [1,1,0,1,1],
    [0,1,1,1,0],
    [1,0,1,0,1],
  ]
  const colors = ['#8B5CF6','#A78BFA','#7C3AED','#6D28D9','#DDD6FE']
  return (
    <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
      {/* Calendar header */}
      <rect x="4" y="4" width="80" height="64" rx="8" fill="#F5F3FF" />
      <rect x="4" y="4" width="80" height="18" rx="8" fill="#8B5CF6" />
      <rect x="4" y="14" width="80" height="8" fill="#8B5CF6" />
      {/* Day labels */}
      {days.map((d, i) => (
        <text key={d+i} x={16 + i * 15} y="17" fontSize="7" fontWeight="700" fill="white" textAnchor="middle" fontFamily="system-ui">{d}</text>
      ))}
      {/* Shift blocks */}
      {blocks.map((row, r) =>
        row.map((on, c) => on ? (
          <rect key={`${r}-${c}`} x={9 + c * 15} y={26 + r * 14} width="11" height="9" rx="3" fill={colors[c]} opacity="0.85" />
        ) : null)
      )}
    </svg>
  )
}

function TimeClockIllustration() {
  return (
    <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
      {/* Clock face */}
      <circle cx="44" cy="36" r="28" fill="#FEF3C7" />
      <circle cx="44" cy="36" r="28" stroke="#F59E0B" strokeWidth="3" fill="none" />
      {/* Hour marks */}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
        const r1 = 22, r2 = i % 3 === 0 ? 17 : 19
        const rad = (deg - 90) * Math.PI / 180
        return <line key={deg} x1={44 + r1 * Math.cos(rad)} y1={36 + r1 * Math.sin(rad)}
          x2={44 + r2 * Math.cos(rad)} y2={36 + r2 * Math.sin(rad)}
          stroke="#F59E0B" strokeWidth={i % 3 === 0 ? 2 : 1} strokeLinecap="round" />
      })}
      {/* Hour hand — pointing to ~9 */}
      <line x1="44" y1="36" x2="30" y2="30" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
      {/* Minute hand — pointing to ~12 */}
      <line x1="44" y1="36" x2="44" y2="18" stroke="#B45309" strokeWidth="2" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="44" cy="36" r="3" fill="#F59E0B" />
      {/* Live green dot */}
      <circle cx="66" cy="14" r="5" fill="#1D9E75" />
      <circle cx="66" cy="14" r="5" fill="#1D9E75" opacity="0.4">
        <animate attributeName="r" values="5;9;5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

function PTOIllustration() {
  return (
    <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
      {/* Sky */}
      <rect x="4" y="4" width="80" height="64" rx="10" fill="#E0F2FE" />
      {/* Sun */}
      <circle cx="62" cy="20" r="10" fill="#FCD34D" />
      {[0,45,90,135,180,225,270,315].map(deg => {
        const rad = deg * Math.PI / 180
        return <line key={deg} x1={62 + 12*Math.cos(rad)} y1={20 + 12*Math.sin(rad)}
          x2={62 + 16*Math.cos(rad)} y2={20 + 16*Math.sin(rad)}
          stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
      })}
      {/* Ground */}
      <ellipse cx="44" cy="66" rx="36" ry="6" fill="#BBF7D0" />
      {/* Umbrella pole */}
      <line x1="32" y1="38" x2="44" y2="64" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
      {/* Umbrella top */}
      <path d="M14 38 Q32 18 50 38" fill="#0EA5E9" />
      <path d="M14 38 Q32 18 50 38" stroke="#0284C7" strokeWidth="1.5" fill="none" />
      <line x1="14" y1="38" x2="32" y2="22" stroke="#0284C7" strokeWidth="1" />
      <line x1="32" y1="22" x2="50" y2="38" stroke="#0284C7" strokeWidth="1" />
      {/* Calendar mini */}
      <rect x="54" y="44" width="22" height="18" rx="4" fill="white" opacity="0.9" />
      <rect x="54" y="44" width="22" height="6" rx="4" fill="#0EA5E9" />
      <rect x="54" y="47" width="22" height="3" fill="#0EA5E9" />
      {[0,1,2,3,4,5].map(i => (
        <circle key={i} cx={58 + (i % 3) * 7} cy={55 + Math.floor(i/3) * 5} r="1.5"
          fill={i === 1 || i === 4 ? '#0EA5E9' : '#CBD5E1'} />
      ))}
    </svg>
  )
}

function OpenShiftsIllustration() {
  return (
    <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
      {/* Calendar */}
      <rect x="6" y="8" width="64" height="58" rx="8" fill="white" stroke="#FED7AA" strokeWidth="2" />
      <rect x="6" y="8" width="64" height="18" rx="8" fill="#F97316" />
      <rect x="6" y="18" width="64" height="8" fill="#F97316" />
      {/* Rings */}
      <rect x="20" y="4" width="5" height="10" rx="2.5" fill="#EA580C" />
      <rect x="51" y="4" width="5" height="10" rx="2.5" fill="#EA580C" />
      {/* Grid cells */}
      {Array.from({ length: 12 }).map((_, i) => {
        const col = i % 4, row = Math.floor(i / 4)
        const isOpen = i === 5
        return (
          <rect key={i} x={14 + col * 14} y={32 + row * 13} width="10" height="9" rx="2"
            fill={isOpen ? '#FFF7ED' : '#FED7AA'} stroke={isOpen ? '#F97316' : 'none'} strokeWidth="1.5" strokeDasharray={isOpen ? '2 1' : '0'} />
        )
      })}
      {/* Plus icon on open slot */}
      <line x1="33" y1="37" x2="33" y2="43" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="40" x2="36" y2="40" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
      {/* Notification dot */}
      <circle cx="76" cy="16" r="8" fill="#EF4444" />
      <text x="76" y="20" fontSize="9" fontWeight="800" fill="white" textAnchor="middle" fontFamily="system-ui">!</text>
    </svg>
  )
}

function AnnouncementsIllustration() {
  return (
    <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
      {/* Megaphone body */}
      <path d="M18 28 L48 18 L48 52 L18 42 Z" fill="#EC4899" />
      <rect x="8" y="28" width="12" height="14" rx="3" fill="#BE185D" />
      {/* Bell/speaker */}
      <path d="M48 22 Q68 26 68 36 Q68 46 48 50 Z" fill="#F9A8D4" />
      <path d="M48 22 Q68 26 68 36 Q68 46 48 50 Z" stroke="#EC4899" strokeWidth="1.5" fill="#F9A8D4" />
      {/* Sound waves */}
      {[0, 1, 2].map(i => (
        <path key={i}
          d={`M ${72 + i * 5} ${30 - i * 2} Q ${75 + i * 5} 36 ${72 + i * 5} ${42 + i * 2}`}
          stroke="#EC4899" strokeWidth="2" fill="none" strokeLinecap="round" opacity={1 - i * 0.25} />
      ))}
      {/* Stars/sparkles */}
      {[[16, 14, 4], [74, 12, 3], [12, 58, 3]].map(([x, y, r], i) => (
        <g key={i}>
          <line x1={x} y1={y-r} x2={x} y2={y+r} stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" />
          <line x1={x-r} y1={y} x2={x+r} y2={y} stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ))}
      {/* Handle */}
      <line x1="14" y1="42" x2="10" y2="56" stroke="#BE185D" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function OnboardingIllustration() {
  return (
    <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
      {/* Clipboard */}
      <rect x="14" y="10" width="46" height="58" rx="6" fill="white" stroke="#C7D2FE" strokeWidth="2" />
      <rect x="14" y="10" width="46" height="58" rx="6" fill="#EEF2FF" />
      {/* Clip */}
      <rect x="28" y="6" width="18" height="10" rx="5" fill="#6366F1" />
      <rect x="32" y="8" width="10" height="6" rx="3" fill="white" />
      {/* Lines */}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x="22" y={26 + i * 9} width={i < 2 ? 28 : 20} height="4" rx="2"
          fill={i === 0 ? '#6366F1' : '#C7D2FE'} opacity={0.8} />
      ))}
      {/* Checkmarks */}
      {[0,2,4].map(i => (
        <g key={i}>
          <circle cx="56" cy={28 + i * 9} r="5" fill="#1D9E75" opacity="0.9" />
          <path d={`M53 ${28 + i * 9} L55 ${30 + i * 9} L59 ${26 + i * 9}`} stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      ))}
      {/* Pencil */}
      <g transform="translate(60,8) rotate(35)">
        <rect x="-3" y="0" width="6" height="24" rx="2" fill="#FCD34D" />
        <polygon points="-3,24 3,24 0,32" fill="#F97316" />
        <rect x="-3" y="0" width="6" height="5" rx="2" fill="#9CA3AF" />
      </g>
    </svg>
  )
}

function PayrollIllustration() {
  return (
    <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
      {/* Stack of bills */}
      {[4, 2, 0].map(off => (
        <g key={off}>
          <rect x={10 + off} y={28 - off} width="60" height="36" rx="5" fill={off === 0 ? '#D1FAE5' : '#A7F3D0'} stroke="#6EE7B7" strokeWidth="1.5" />
          <circle cx={40 + off} cy={46 - off} r="9" fill="#6EE7B7" opacity="0.5" />
          <text x={40 + off} y={50 - off} fontSize="12" fontWeight="800" fill="#065F46" textAnchor="middle" fontFamily="system-ui">$</text>
        </g>
      ))}
      {/* Coin */}
      <circle cx="68" cy="18" r="12" fill="#FCD34D" />
      <circle cx="68" cy="18" r="9" fill="#F59E0B" />
      <text x="68" y="22" fontSize="10" fontWeight="800" fill="#78350F" textAnchor="middle" fontFamily="system-ui">$</text>
      {/* Coming soon badge */}
      <rect x="4" y="4" width="52" height="14" rx="7" fill="#1D9E75" opacity="0.15" />
      <text x="30" y="14" fontSize="7" fontWeight="700" fill="#065F46" textAnchor="middle" fontFamily="system-ui">COMING SOON</text>
    </svg>
  )
}

function ComplianceIllustration() {
  return (
    <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
      {/* Shield */}
      <path d="M44 8 L70 20 L70 44 Q70 64 44 70 Q18 64 18 44 L18 20 Z" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="2" />
      <path d="M44 14 L64 24 L64 44 Q64 60 44 65 Q24 60 24 44 L24 24 Z" fill="#BFDBFE" />
      {/* Checkmark */}
      <path d="M33 40 L41 48 L58 30" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Tooth silhouette at bottom */}
      <path d="M34 64 Q36 58 39 58 Q41 56 44 58 Q47 56 49 58 Q52 58 54 64" stroke="#93C5FD" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Coming soon badge */}
      <rect x="4" y="4" width="52" height="14" rx="7" fill="#3B82F6" opacity="0.15" />
      <text x="30" y="14" fontSize="7" fontWeight="700" fill="#1E40AF" textAnchor="middle" fontFamily="system-ui">COMING SOON</text>
    </svg>
  )
}

// ─── Probation alert fetch ────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'

// ─── Module data ──────────────────────────────────────────────────────────────

const MODULES = [
  {
    href: '/staff',
    title: 'Staff',
    desc: 'Directory, roles & status',
    accent: '#1D9E75',
    bg: '#F0FDF9',
    border: '#A7F3D0',
    illustration: <StaffIllustration />,
    active: true,
  },
  {
    href: '/schedules',
    title: 'Schedules',
    desc: 'Weekly shift grid',
    accent: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    illustration: <SchedulesIllustration />,
    active: true,
  },
  {
    href: '/time-clock',
    title: 'Time Clock',
    desc: 'Live clock-in board & today\'s log',
    accent: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    illustration: <TimeClockIllustration />,
    active: true,
  },
  {
    href: '/pto',
    title: 'PTO Manager',
    desc: 'Requests, team calendar & blackout dates',
    accent: '#0284C7',
    bg: '#F0F9FF',
    border: '#BAE6FD',
    illustration: <PTOIllustration />,
    active: true,
  },
  {
    href: '/open-shifts',
    title: 'Open Shifts',
    desc: 'Post & manage unfilled shifts',
    accent: '#EA580C',
    bg: '#FFF7ED',
    border: '#FED7AA',
    illustration: <OpenShiftsIllustration />,
    active: true,
  },
  {
    href: '/announcements',
    title: 'Announcements',
    desc: 'Broadcast messages to your staff',
    accent: '#BE185D',
    bg: '#FDF2F8',
    border: '#FBCFE8',
    illustration: <AnnouncementsIllustration />,
    active: true,
  },
  {
    href: '/onboarding',
    title: 'Onboarding',
    desc: 'HR forms, training & manual sign-off',
    accent: '#4F46E5',
    bg: '#EEF2FF',
    border: '#C7D2FE',
    illustration: <OnboardingIllustration />,
    active: true,
  },
  {
    href: '#',
    title: 'Payroll',
    desc: 'Manage payroll',
    accent: '#059669',
    bg: '#F0FDF4',
    border: '#BBF7D0',
    illustration: <PayrollIllustration />,
    active: false,
  },
  {
    href: '#',
    title: 'Compliance',
    desc: 'Manage compliance',
    accent: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    illustration: <ComplianceIllustration />,
    active: false,
  },
]

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [probationCount, setProbationCount] = useState(0)

  useEffect(() => {
    fetch(`${API_BASE}/api/staff/probation-alerts?practiceId=${PRACTICE_ID}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setProbationCount(data.length) })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      <header className="bg-[#2C3E3A]">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="10" fill="#1E2E2A" />
              <path d="M8 16 Q15 11 22 16 Q29 21 36 16" stroke="#A8D5E2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M8 22 Q16 16 24 22 Q30 26 36 22" stroke="#5BA4BE" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M8 28 Q14 23 20 28 Q28 34 36 28" stroke="#8BAF9A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </svg>
            <div>
              <h1 className="text-base font-bold text-[#FAF6EF] leading-tight tracking-wide">BRISA</h1>
              <p className="text-[10px] text-[#8BAF9A] tracking-widest uppercase leading-tight">Admin Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#1D9E75]" />
            <span className="text-xs text-[#8BAF9A]">Live</span>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Overview</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MODULES.map((mod) => {
            const Tag = mod.active && mod.href !== '#' ? 'a' : 'div'
            return (
              <Tag
                key={mod.title}
                {...(mod.active && mod.href !== '#' ? { href: mod.href } : {})}
                className={`group relative overflow-hidden rounded-2xl border-2 p-5 transition-all ${
                  mod.active && mod.href !== '#'
                    ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5'
                    : 'cursor-default opacity-75'
                }`}
                style={{
                  background: mod.bg,
                  borderColor: mod.border,
                }}
              >
                {/* Illustration — top right */}
                <div className="absolute -top-1 -right-2 opacity-90 transition-transform group-hover:scale-105 group-hover:-rotate-2">
                  {mod.illustration}
                </div>

                {/* Text — bottom left */}
                <div className="relative mt-16">
                  <div className="flex items-center gap-2">
                  <h3
                    className="text-base font-bold leading-tight"
                    style={{ color: mod.active ? mod.accent : '#9CA3AF' }}
                  >
                    {mod.title}
                  </h3>
                  {mod.title === 'Staff' && probationCount > 0 && (
                    <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                      {probationCount}
                    </span>
                  )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 leading-snug">{mod.desc}</p>
                  </div>

                {/* Active arrow hint */}
                {mod.active && mod.href !== '#' && (
                  <div
                    className="absolute bottom-4 right-4 text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: mod.accent }}
                  >
                    →
                  </div>
                )}
              </Tag>
            )
          })}
        </div>
      </main>
    </div>
  )
}
