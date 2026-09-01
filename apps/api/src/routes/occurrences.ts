import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

// Auto-logged types use upsert (prevent duplicates); formal docs always create new records
const AUTO_TYPES = new Set(['tardy', 'unexcused_absence'])
const FORMAL_TYPES = new Set(['verbal_warning', 'written_warning', 'performance_note', 'termination'])

const managerSelect = { id: true, firstName: true, lastName: true, role: true }

export default async function occurrenceRoutes(server: FastifyInstance) {
  // GET /api/occurrences?practiceId=&userId=&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  server.get<{ Querystring: { practiceId: string; userId?: string; startDate?: string; endDate?: string } }>(
    '/occurrences',
    async (request, reply) => {
      const { practiceId, userId, startDate, endDate } = request.query
      if (!practiceId) return reply.status(400).send({ error: 'practiceId is required' })

      const dateFilter = startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}

      const occurrences = await prisma.employeeOccurrence.findMany({
        where: { practiceId, ...(userId ? { userId } : {}), ...dateFilter },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          manager: { select: managerSelect },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      })

      return reply.send(occurrences)
    }
  )

  // POST /api/occurrences
  server.post<{
    Body: {
      practiceId: string
      userId: string
      date: string
      type: string
      notes?: string
      // Formal doc fields
      title?: string
      body?: string
      managerSignatureName?: string
    }
  }>('/occurrences', async (request, reply) => {
    const { practiceId, userId, date, type, notes, title, body, managerSignatureName } = request.body
    if (!practiceId || !userId || !date || !type) {
      return reply.status(400).send({ error: 'practiceId, userId, date, and type are required' })
    }

    const isFormal = FORMAL_TYPES.has(type)
    const managerId = isFormal ? request.user.userId : null
    const now = new Date()

    if (AUTO_TYPES.has(type)) {
      // Upsert to prevent duplicate auto-log entries for the same day
      const occ = await prisma.employeeOccurrence.upsert({
        where: { userId_date_type: { userId, date: new Date(date), type } },
        create: { practiceId, userId, date: new Date(date), type, notes: notes ?? null },
        update: { notes: notes ?? undefined },
        include: { user: { select: { id: true, firstName: true, lastName: true } }, manager: { select: managerSelect } },
      })
      return reply.status(201).send(occ)
    }

    // Formal document — always a new record
    const occ = await prisma.employeeOccurrence.create({
      data: {
        practiceId,
        userId,
        date: new Date(date),
        type,
        notes: notes ?? null,
        title: title ?? null,
        body: body ?? null,
        managerId,
        managerSignedAt: isFormal && managerSignatureName ? now : null,
        managerSignatureName: isFormal ? (managerSignatureName ?? null) : null,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } }, manager: { select: managerSelect } },
    })

    return reply.status(201).send(occ)
  })

  // PATCH /api/occurrences/:id — update body/notes or record acknowledgment
  server.patch<{
    Params: { id: string }
    Body: {
      notes?: string
      title?: string
      body?: string
      managerSignatureName?: string
      staffSignatureName?: string
      acknowledge?: boolean
    }
  }>('/occurrences/:id', async (request, reply) => {
    const practiceId = request.user.practiceId
    const { id } = request.params
    const { notes, title, body, managerSignatureName, staffSignatureName, acknowledge } = request.body

    const existing = await prisma.employeeOccurrence.findUnique({
      where: { id },
      select: { practiceId: true, managerSignedAt: true },
    })
    if (!existing || existing.practiceId !== practiceId) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const data: Record<string, unknown> = {}
    if (notes !== undefined) data.notes = notes ?? null
    if (title !== undefined) data.title = title ?? null
    if (body !== undefined) data.body = body ?? null

    if (managerSignatureName !== undefined && managerSignatureName) {
      data.managerId = request.user.userId
      data.managerSignedAt = new Date()
      data.managerSignatureName = managerSignatureName
    }

    if (acknowledge === true && staffSignatureName) {
      data.staffAcknowledgedAt = new Date()
      data.staffSignatureName = staffSignatureName
    }

    const occ = await prisma.employeeOccurrence.update({
      where: { id },
      data,
      include: { user: { select: { id: true, firstName: true, lastName: true } }, manager: { select: managerSelect } },
    })

    return reply.send(occ)
  })

  // GET /api/occurrences/:id/audit — fetch audit trail for an entry
  server.get<{ Params: { id: string } }>(
    '/occurrences/:id/audit',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const { id } = request.params

      const occ = await prisma.employeeOccurrence.findUnique({ where: { id }, select: { practiceId: true } })
      if (!occ || occ.practiceId !== practiceId) return reply.status(404).send({ error: 'Not found' })

      const audits = await prisma.occurrenceAudit.findMany({
        where: { occurrenceId: id },
        include: { editor: { select: { id: true, firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(audits)
    }
  )

  // PATCH /api/occurrences/:id/override — super admin edit with audit trail
  server.patch<{
    Params: { id: string }
    Body: {
      title?: string
      body?: string
      notes?: string
      type?: string
      date?: string
      reason: string  // required: why the override was made
    }
  }>('/occurrences/:id/override', async (request, reply) => {
    const practiceId = request.user.practiceId
    const editorId = request.user.userId
    const editorRole = request.user.role
    const { id } = request.params
    const { title, body, notes, type, date, reason } = request.body

    if (!reason?.trim()) return reply.status(400).send({ error: 'reason is required for overrides' })
    if (!['manager', 'doctor'].includes(editorRole)) {
      return reply.status(403).send({ error: 'Only managers can override log entries' })
    }

    const existing = await prisma.employeeOccurrence.findUnique({ where: { id } })
    if (!existing || existing.practiceId !== practiceId) return reply.status(404).send({ error: 'Not found' })

    const updates: Record<string, unknown> = {}
    const auditRows: { field: string; oldValue: string | null; newValue: string | null }[] = []

    function track(field: string, newVal: string | undefined, oldVal: string | null | undefined) {
      if (newVal === undefined) return
      const oldStr = oldVal ?? null
      const newStr = newVal || null
      if (oldStr !== newStr) {
        updates[field] = newStr
        auditRows.push({ field, oldValue: oldStr, newValue: newStr })
      }
    }

    track('title', title, existing.title)
    track('body', body, existing.body)
    track('notes', notes, existing.notes)
    track('type', type, existing.type)
    if (date !== undefined) {
      const newDate = new Date(date)
      const oldDate = existing.date.toISOString().split('T')[0]
      const newDateStr = newDate.toISOString().split('T')[0]
      if (oldDate !== newDateStr) {
        updates['date'] = newDate
        auditRows.push({ field: 'date', oldValue: oldDate, newValue: newDateStr })
      }
    }

    if (Object.keys(updates).length === 0) return reply.status(400).send({ error: 'No changes provided' })

    const [occ] = await prisma.$transaction([
      prisma.employeeOccurrence.update({
        where: { id },
        data: updates,
        include: { user: { select: { id: true, firstName: true, lastName: true } }, manager: { select: managerSelect } },
      }),
      ...auditRows.map(row =>
        prisma.occurrenceAudit.create({
          data: { occurrenceId: id, practiceId, editorId, reason: reason.trim(), ...row },
        })
      ),
    ])

    return reply.send(occ)
  })

  // DELETE /api/occurrences/:id
  server.delete<{ Params: { id: string } }>(
    '/occurrences/:id',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const { id } = request.params

      const existing = await prisma.employeeOccurrence.findUnique({ where: { id }, select: { practiceId: true } })
      if (!existing || existing.practiceId !== practiceId) {
        return reply.status(404).send({ error: 'Not found' })
      }

      await prisma.employeeOccurrence.delete({ where: { id } })
      return reply.status(204).send()
    }
  )
}
