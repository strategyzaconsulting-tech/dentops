import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const PRACTICE_ID = 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357'

const NEXT_STEPS_OPTIONS = [
  { key: 'benefits', label: 'Eligible for benefits' },
  { key: 'permanent', label: 'Permanent status confirmed' },
  { key: 'additional_probation', label: 'Additional probation period' },
  { key: 'pip', label: 'Performance Improvement Plan (PIP)' },
  { key: 'termination', label: 'Termination recommended' },
]

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Member {
  id: string
  hireDate: string | null
  probationDays: number | null
  probationEndDate: string | null
  probationStatus: string | null
  probationNotes: string | null
  probationCompletedAt: string | null
  probationAlertDays: number | null
  benefitsEligibleAt: string | null
}

interface Props {
  member: Member
  onUpdated: () => void
}

export default function ProbationSection({ member, onUpdated }: Props) {
  const [showReview, setShowReview] = useState(false)
  const [reviewOutcome, setReviewOutcome] = useState<'passed' | 'failed'>('passed')
  const [nextSteps, setNextSteps] = useState<string[]>(['benefits', 'permanent'])
  const [reviewNotes, setReviewNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!member.probationEndDate && !member.probationDays) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const endDate = member.probationEndDate ? new Date(member.probationEndDate) : null
  if (endDate) endDate.setHours(0, 0, 0, 0)

  const daysLeft = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / 86400000) : null
  const alertDays = member.probationAlertDays ?? 14
  const isOverdue = daysLeft !== null && daysLeft < 0
  const isApproaching = daysLeft !== null && daysLeft >= 0 && daysLeft <= alertDays
  const isActive = !member.probationStatus || member.probationStatus === 'active'
  const isPassed = member.probationStatus === 'passed'
  const isFailed = member.probationStatus === 'failed'

  // Progress bar: 0% on hire date, 100% on end date
  let progress = 100
  if (isActive && endDate && member.hireDate) {
    const hire = new Date(member.hireDate)
    const total = endDate.getTime() - hire.getTime()
    const elapsed = today.getTime() - hire.getTime()
    progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
  }

  async function submitReview() {
    setSubmitting(true)
    try {
      const completedAt = toISODate(today)
      const benefitsDate =
        reviewOutcome === 'passed' && nextSteps.includes('benefits') && endDate
          ? toISODate(endDate)
          : null

      const payload: Record<string, unknown> = {
        probationStatus: reviewOutcome,
        probationNotes: reviewNotes.trim() || null,
        probationCompletedAt: completedAt,
        benefitsEligibleAt: benefitsDate,
      }

      await fetch(`${API_BASE}/api/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Log an occurrence note
      await fetch(`${API_BASE}/api/occurrences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId: PRACTICE_ID,
          userId: member.id,
          date: completedAt,
          type: 'note',
          notes: `Probationary period ${reviewOutcome === 'passed' ? 'completed satisfactorily' : 'did not pass'}. ${reviewNotes.trim()}${nextSteps.length ? ' Next steps: ' + nextSteps.map(k => NEXT_STEPS_OPTIONS.find(o => o.key === k)?.label ?? k).join(', ') + '.' : ''}`.trim(),
        }),
      })

      setShowReview(false)
      onUpdated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="px-6 py-5 border-t border-gray-100">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        Probationary Period
      </h3>

      {/* Completed badge */}
      {isPassed && (
        <div className="flex items-center gap-3 rounded-xl bg-[#E8F5F0] border border-[#A7F3D0] px-4 py-3 mb-3">
          <span className="text-2xl">✓</span>
          <div>
            <p className="text-sm font-bold text-[#065F46]">Completed Satisfactorily</p>
            <p className="text-xs text-[#047857]">
              {member.probationCompletedAt ? `Reviewed ${fmtDate(member.probationCompletedAt)}` : ''}
              {member.benefitsEligibleAt ? ` · Benefits eligible ${fmtDate(member.benefitsEligibleAt)}` : ''}
            </p>
            {member.probationNotes && <p className="text-xs text-gray-500 mt-1 italic">"{member.probationNotes}"</p>}
          </div>
        </div>
      )}

      {isFailed && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-3">
          <span className="text-2xl">✕</span>
          <div>
            <p className="text-sm font-bold text-red-700">Did Not Pass</p>
            <p className="text-xs text-red-500">
              {member.probationCompletedAt ? `Reviewed ${fmtDate(member.probationCompletedAt)}` : ''}
            </p>
            {member.probationNotes && <p className="text-xs text-gray-500 mt-1 italic">"{member.probationNotes}"</p>}
          </div>
        </div>
      )}

      {isActive && (
        <>
          {/* Info row */}
          <div className="flex items-center justify-between text-sm mb-3">
            <div className="flex items-center gap-3">
              {member.probationDays && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                  {member.probationDays}-day probation
                </span>
              )}
              {endDate && (
                <span className="text-xs text-gray-500">
                  Ends {fmtDate(member.probationEndDate)}
                </span>
              )}
            </div>
            {daysLeft !== null && (
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                isOverdue ? 'bg-red-100 text-red-700'
                : isApproaching ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600'
              }`}>
                {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {endDate && (
            <div className="mb-3">
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isOverdue ? 'bg-red-500' : isApproaching ? 'bg-amber-400' : 'bg-[#1D9E75]'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Alert banner */}
          {(isApproaching || isOverdue) && !showReview && (
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-3 ${
              isOverdue ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
            }`}>
              <div>
                <p className={`text-sm font-bold ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
                  {isOverdue ? 'Review Overdue' : 'Review Approaching'}
                </p>
                <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                  {isOverdue
                    ? `Probation ended ${Math.abs(daysLeft!)} day${Math.abs(daysLeft!) !== 1 ? 's' : ''} ago — complete the review.`
                    : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} until probation ends — prepare the review.`}
                </p>
              </div>
              <button
                onClick={() => setShowReview(true)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                  isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                Complete Review
              </button>
            </div>
          )}

          {/* Review form */}
          {showReview && (
            <div className="rounded-xl border-2 border-[#1D9E75] bg-[#F0FAF6] p-4 space-y-4">
              <p className="text-sm font-bold text-gray-800">Probation Review</p>

              {/* Outcome */}
              <div className="flex gap-3">
                {(['passed', 'failed'] as const).map(o => (
                  <button
                    key={o}
                    onClick={() => {
                      setReviewOutcome(o)
                      setNextSteps(o === 'passed' ? ['benefits', 'permanent'] : [])
                    }}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-2 transition-all ${
                      reviewOutcome === o
                        ? o === 'passed'
                          ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                          : 'bg-red-600 border-red-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {o === 'passed' ? '✓ Completed Satisfactorily' : '✕ Did Not Pass'}
                  </button>
                ))}
              </div>

              {/* Next steps */}
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Next Steps</p>
                <div className="space-y-1.5">
                  {NEXT_STEPS_OPTIONS
                    .filter(o =>
                      reviewOutcome === 'passed'
                        ? ['benefits', 'permanent'].includes(o.key)
                        : ['additional_probation', 'pip', 'termination'].includes(o.key)
                    )
                    .map(o => {
                      const checked = nextSteps.includes(o.key)
                      return (
                        <label key={o.key} className="flex items-center gap-2.5 cursor-pointer">
                          <div
                            onClick={() => setNextSteps(prev =>
                              checked ? prev.filter(k => k !== o.key) : [...prev, o.key]
                            )}
                            className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              checked ? 'bg-[#1D9E75] border-[#1D9E75]' : 'border-gray-300 bg-white'
                            }`}
                          >
                            {checked && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
                          </div>
                          <span className="text-sm text-gray-700">{o.label}</span>
                        </label>
                      )
                    })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                  Manager Notes
                </label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
                  rows={3}
                  placeholder="Summary of performance during probationary period…"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowReview(false)}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-[#F0EDE5]"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReview}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#1D9E75] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Submit Review'}
                </button>
              </div>
            </div>
          )}

          {/* Manual review trigger when not yet approaching */}
          {!isApproaching && !isOverdue && !showReview && (
            <button
              onClick={() => setShowReview(true)}
              className="text-xs text-gray-400 hover:text-[#1D9E75] hover:underline"
            >
              Complete review early →
            </button>
          )}
        </>
      )}
    </section>
  )
}
