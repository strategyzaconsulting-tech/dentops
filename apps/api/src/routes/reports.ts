import type { FastifyInstance } from 'fastify'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../lib/prisma.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TYPE_LABEL: Record<string, string> = {
  tardy: 'Tardy',
  unexcused_absence: 'Unexcused Absence',
  verbal_warning: 'Verbal Warning',
  written_warning: 'Written Warning',
  note: 'Event of Note',
}

function fmt12h(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default async function reportRoutes(server: FastifyInstance) {
  // GET /api/staff/:id/report?practiceId=&days=365
  server.get<{ Params: { id: string }; Querystring: { practiceId: string; days?: string } }>(
    '/staff/:id/report',
    async (request, reply) => {
      const { id } = request.params
      const { practiceId, days = '365' } = request.query

      if (!practiceId) return reply.status(400).send({ error: 'practiceId is required' })
      if (!process.env.ANTHROPIC_API_KEY) {
        return reply.status(503).send({ error: 'ANTHROPIC_API_KEY not configured' })
      }

      const periodDays = Math.min(parseInt(days, 10) || 365, 730)
      const periodStart = new Date()
      periodStart.setDate(periodStart.getDate() - periodDays)
      periodStart.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(23, 59, 59, 999)

      const [user, occurrences, shifts, punches, allStaff] = await Promise.all([
        prisma.user.findUnique({
          where: { id },
          select: {
            id: true, firstName: true, lastName: true, email: true,
            role: true, status: true, shiftStart: true, shiftEnd: true,
            hireDate: true, managerId: true,
          },
        }),
        prisma.employeeOccurrence.findMany({
          where: { userId: id, practiceId },
          orderBy: { date: 'desc' },
        }),
        prisma.shift.findMany({
          where: { userId: id, practiceId, date: { gte: periodStart, lte: today } },
          orderBy: { date: 'asc' },
        }),
        prisma.timePunch.findMany({
          where: { userId: id, practiceId, punchIn: { gte: periodStart, lte: today } },
          orderBy: { punchIn: 'asc' },
        }),
        prisma.user.findMany({
          where: { practiceId },
          select: { id: true, firstName: true, lastName: true, role: true },
        }),
      ])

      if (!user) return reply.status(404).send({ error: 'Staff member not found' })

      const manager = user.managerId
        ? allStaff.find(s => s.id === user.managerId)
        : null

      // Stats
      const pastShifts = shifts.filter(s => new Date(s.date) < new Date(new Date().setHours(0,0,0,0)))
      const scheduledDays = pastShifts.length
      const tardies = occurrences.filter(o => o.type === 'tardy').length
      const absences = occurrences.filter(o => o.type === 'unexcused_absence').length
      const verbalWarnings = occurrences.filter(o => o.type === 'verbal_warning').length
      const writtenWarnings = occurrences.filter(o => o.type === 'written_warning').length
      const attendanceRate = scheduledDays > 0
        ? Math.max(0, Math.round(((scheduledDays - absences) / scheduledDays) * 100))
        : null
      const tardyRate = scheduledDays > 0
        ? Math.round((tardies / scheduledDays) * 100)
        : null

      // Build prompt context
      const hireDateStr = user.hireDate
        ? new Date(user.hireDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'Not on file'

      const occSummary = occurrences.length === 0
        ? 'No occurrences on record.'
        : occurrences.map(o => {
            const d = new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            return `- ${d}: ${TYPE_LABEL[o.type] ?? o.type}${o.notes ? ` — "${o.notes}"` : ''}`
          }).join('\n')

      const prompt = `You are an HR assistant generating a professional employee performance summary for a dental practice.

EMPLOYEE PROFILE:
- Name: ${user.firstName} ${user.lastName}
- Role: ${user.role.replace('_', ' ')}
- Status: ${user.status}
- Hire Date: ${hireDateStr}
- Manager: ${manager ? `${manager.firstName} ${manager.lastName}` : 'Not assigned'}
- Default Shift: ${fmt12h(user.shiftStart) ?? 'N/A'} – ${fmt12h(user.shiftEnd) ?? 'N/A'}

ATTENDANCE (past ${periodDays} days):
- Scheduled Days: ${scheduledDays}
- Days Present: ${scheduledDays - absences}
- Tardies: ${tardies}${tardyRate !== null ? ` (${tardyRate}% of scheduled shifts)` : ''}
- Unexcused Absences: ${absences}
- Attendance Rate: ${attendanceRate !== null ? `${attendanceRate}%` : 'N/A'}

OCCURRENCE LOG (all time, ${occurrences.length} total):
${occSummary}

Write a concise, professional HR cliff-notes summary of this employee. Cover:
1. A brief overall performance and reliability assessment (2-3 sentences)
2. Attendance pattern analysis — note any trends, frequency, or escalation in tardies/absences
3. Disciplinary history — summarize any warnings and whether the pattern improved or worsened
4. Strengths or positive indicators visible in the data
5. Risk level: Low / Moderate / High — with one sentence of rationale

Be direct and factual. Write in third person. Keep the full response under 250 words. Do not use bullet points — write in short paragraphs per section with a bold label on each (e.g. **Overall:**, **Attendance:**, etc.).`

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      })

      const aiSummary = message.content[0].type === 'text' ? message.content[0].text : ''

      return reply.send({
        generatedAt: new Date().toISOString(),
        periodDays,
        employee: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          status: user.status,
          hireDate: user.hireDate,
          shiftStart: user.shiftStart,
          shiftEnd: user.shiftEnd,
          manager: manager ? `${manager.firstName} ${manager.lastName}` : null,
        },
        attendance: {
          scheduledDays,
          daysPresent: scheduledDays - absences,
          tardies,
          tardyRate,
          absences,
          attendanceRate,
          verbalWarnings,
          writtenWarnings,
          totalPunches: punches.length,
        },
        occurrences,
        aiSummary,
      })
    }
  )
}
