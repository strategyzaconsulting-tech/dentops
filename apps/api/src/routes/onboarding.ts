import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

const FORM_FIELDS = ['i9', 'w4', 'personal-info', 'emergency-contact', 'direct-deposit'] as const
type FormType = (typeof FORM_FIELDS)[number]

function hasData(data: unknown): boolean {
  return !!data && typeof data === 'object' && Object.keys(data as object).length > 0
}

function completionPct(checklist: {
  i9CompletedAt: Date | null;   i9Data: unknown
  w4CompletedAt: Date | null;   w4Data: unknown
  personalInfoCompletedAt: Date | null;       personalInfoData: unknown
  emergencyContactCompletedAt: Date | null;   emergencyContactData: unknown
  directDepositCompletedAt: Date | null;      directDepositData: unknown
  equipmentItems?: { id: string }[]
}): number {
  const completed = [
    checklist.i9CompletedAt && hasData(checklist.i9Data) && (checklist.i9Data as Record<string,unknown>)?.signatureName,
    checklist.w4CompletedAt && hasData(checklist.w4Data) && (checklist.w4Data as Record<string,unknown>)?.signatureName,
    checklist.personalInfoCompletedAt && hasData(checklist.personalInfoData),
    checklist.emergencyContactCompletedAt && hasData(checklist.emergencyContactData),
    checklist.directDepositCompletedAt && hasData(checklist.directDepositData),
    checklist.equipmentItems && checklist.equipmentItems.length > 0,
  ].filter(Boolean).length
  return Math.round((completed / 6) * 100)
}

export default async function onboardingRoutes(server: FastifyInstance) {
  // ─── Onboarding Checklist ───────────────────────────────────────────────

  // GET /api/onboarding?practiceId=&userId= — get or create checklist + equipment
  server.get<{ Querystring: { practiceId: string; userId: string } }>(
    '/onboarding',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      if (!practiceId || !userId)
        return reply.status(400).send({ error: 'practiceId and userId are required' })

      let checklist = await prisma.onboardingChecklist.findUnique({
        where: { practiceId_userId: { practiceId, userId } },
        include: { equipmentItems: true },
      })

      if (!checklist) {
        checklist = await prisma.onboardingChecklist.create({
          data: { practiceId, userId },
          include: { equipmentItems: true },
        })
      }

      return reply.send({ ...checklist, completionPct: completionPct(checklist) })
    }
  )

  // PATCH /api/onboarding/forms?practiceId=&userId= — submit a form
  server.patch<{
    Querystring: { practiceId: string; userId: string }
    Body: { formType: FormType; data: Record<string, unknown> }
  }>(
    '/onboarding/forms',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      const { formType, data } = request.body
      if (!practiceId || !userId) return reply.status(400).send({ error: 'practiceId and userId are required' })
      if (!formType) return reply.status(400).send({ error: 'formType is required' })

      const now = new Date()
      const fieldMap: Record<FormType, { dataField: string; completedField: string }> = {
        'i9':                { dataField: 'i9Data',               completedField: 'i9CompletedAt' },
        'w4':                { dataField: 'w4Data',               completedField: 'w4CompletedAt' },
        'personal-info':     { dataField: 'personalInfoData',     completedField: 'personalInfoCompletedAt' },
        'emergency-contact': { dataField: 'emergencyContactData', completedField: 'emergencyContactCompletedAt' },
        'direct-deposit':    { dataField: 'directDepositData',    completedField: 'directDepositCompletedAt' },
      }

      const fields = fieldMap[formType]
      if (!fields) return reply.status(400).send({ error: `Unknown formType: ${formType}` })

      // Validate required fields before marking complete
      const requiredFields: Partial<Record<FormType, string[]>> = {
        'i9': ['firstName', 'lastName', 'address', 'city', 'state', 'zip', 'dob', 'ssn4', 'citizenshipStatus', 'signatureName'],
        'w4': ['filingStatus', 'signatureName'],
        'personal-info': ['firstName', 'lastName', 'phone', 'email'],
        'emergency-contact': ['name', 'relationship', 'primaryPhone'],
        'direct-deposit': ['bankName', 'accountType', 'routingNumber', 'accountNumber'],
      }
      const required = requiredFields[formType] ?? []
      const missing = required.filter((f) => !data[f] || String(data[f]).trim() === '')
      if (missing.length > 0) {
        return reply.status(422).send({ error: `Missing required fields: ${missing.join(', ')}` })
      }

      const checklist = await prisma.onboardingChecklist.upsert({
        where: { practiceId_userId: { practiceId, userId } },
        create: {
          practiceId,
          userId,
          [fields.dataField]: data,
          [fields.completedField]: now,
        },
        update: {
          [fields.dataField]: data,
          [fields.completedField]: now,
        },
        include: { equipmentItems: true },
      })

      return reply.send({ ...checklist, completionPct: completionPct(checklist) })
    }
  )

  // GET /api/onboarding/all?practiceId= — admin: all checklists with user names + completion %
  server.get<{ Querystring: { practiceId: string } }>(
    '/onboarding/all',
    async (request, reply) => {
      const { practiceId } = request.query
      if (!practiceId) return reply.status(400).send({ error: 'practiceId is required' })

      const checklists = await prisma.onboardingChecklist.findMany({
        where: { practiceId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
          equipmentItems: true,
        },
        orderBy: { createdAt: 'asc' },
      })

      const result = checklists.map((c) => ({ ...c, completionPct: completionPct(c) }))
      return reply.send(result)
    }
  )

  // ─── Equipment ─────────────────────────────────────────────────────────

  // POST /api/onboarding/equipment
  server.post<{
    Body: { practiceId: string; userId: string; name: string; serialNumber?: string; notes?: string }
  }>(
    '/onboarding/equipment',
    async (request, reply) => {
      const { practiceId, userId, name, serialNumber, notes } = request.body
      if (!practiceId || !userId || !name)
        return reply.status(400).send({ error: 'practiceId, userId, and name are required' })

      // Ensure checklist exists
      const checklist = await prisma.onboardingChecklist.upsert({
        where: { practiceId_userId: { practiceId, userId } },
        create: { practiceId, userId },
        update: {},
      })

      const item = await prisma.equipmentItem.create({
        data: {
          practiceId,
          userId,
          onboardingId: checklist.id,
          name,
          serialNumber: serialNumber ?? null,
          notes: notes ?? null,
        },
      })

      return reply.status(201).send(item)
    }
  )

  // PATCH /api/onboarding/equipment/:id
  server.patch<{
    Params: { id: string }
    Body: { returnedAt?: string; notes?: string; name?: string }
  }>(
    '/onboarding/equipment/:id',
    async (request, reply) => {
      const { id } = request.params
      const { returnedAt, notes, name } = request.body

      const item = await prisma.equipmentItem.update({
        where: { id },
        data: {
          ...(returnedAt !== undefined ? { returnedAt: new Date(returnedAt) } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(name !== undefined ? { name } : {}),
        },
      })

      return reply.send(item)
    }
  )

  // DELETE /api/onboarding/equipment/:id
  server.delete<{ Params: { id: string } }>(
    '/onboarding/equipment/:id',
    async (request, reply) => {
      await prisma.equipmentItem.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    }
  )

  // ─── Office Manual ──────────────────────────────────────────────────────

  // GET /api/office-manual?practiceId=&userId=
  server.get<{ Querystring: { practiceId: string; userId?: string } }>(
    '/office-manual',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      if (!practiceId) return reply.status(400).send({ error: 'practiceId is required' })

      const manual = await prisma.officeManual.findUnique({
        where: { practiceId },
        include: {
          signatures: {
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { signedAt: 'asc' },
          },
        },
      })

      if (!manual) return reply.status(404).send({ error: 'No office manual found for this practice' })

      let signedByCurrentUser = false
      if (userId) {
        signedByCurrentUser = manual.signatures.some((s) => s.userId === userId)
      }

      return reply.send({ ...manual, signedByCurrentUser })
    }
  )

  // POST /api/office-manual — create or update manual
  server.post<{
    Body: { practiceId: string; title: string; content: string; version?: string }
  }>(
    '/office-manual',
    async (request, reply) => {
      const { practiceId, title, content, version } = request.body
      if (!practiceId || !title || !content)
        return reply.status(400).send({ error: 'practiceId, title, and content are required' })

      const manual = await prisma.officeManual.upsert({
        where: { practiceId },
        create: { practiceId, title, content, version: version ?? '1.0' },
        update: { title, content, ...(version ? { version } : {}), updatedAt: new Date() },
      })

      return reply.status(201).send(manual)
    }
  )

  // POST /api/office-manual/sign
  server.post<{ Body: { practiceId: string; userId: string } }>(
    '/office-manual/sign',
    async (request, reply) => {
      const { practiceId, userId } = request.body
      if (!practiceId || !userId)
        return reply.status(400).send({ error: 'practiceId and userId are required' })

      const manual = await prisma.officeManual.findUnique({ where: { practiceId } })
      if (!manual) return reply.status(404).send({ error: 'No office manual found' })

      const signature = await prisma.manualSignature.upsert({
        where: { manualId_userId: { manualId: manual.id, userId } },
        create: { manualId: manual.id, practiceId, userId },
        update: { signedAt: new Date() },
      })

      return reply.status(201).send(signature)
    }
  )

  // ─── Training Sessions ──────────────────────────────────────────────────

  // GET /api/training?practiceId=&userId=
  server.get<{ Querystring: { practiceId: string; userId: string } }>(
    '/training',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      if (!practiceId || !userId)
        return reply.status(400).send({ error: 'practiceId and userId are required' })

      const sessions = await prisma.trainingSession.findMany({
        where: { practiceId, userId },
        include: {
          trainer: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      })

      return reply.send(sessions)
    }
  )

  // GET /api/training/all?practiceId=
  server.get<{ Querystring: { practiceId: string } }>(
    '/training/all',
    async (request, reply) => {
      const { practiceId } = request.query
      if (!practiceId) return reply.status(400).send({ error: 'practiceId is required' })

      const sessions = await prisma.trainingSession.findMany({
        where: { practiceId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
          trainer: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      })

      return reply.send(sessions)
    }
  )

  // POST /api/training
  server.post<{
    Body: {
      practiceId: string
      userId: string
      trainerId?: string
      topic: string
      scheduledAt: string
      notes?: string
    }
  }>(
    '/training',
    async (request, reply) => {
      const { practiceId, userId, trainerId, topic, scheduledAt, notes } = request.body
      if (!practiceId || !userId || !topic || !scheduledAt)
        return reply.status(400).send({ error: 'practiceId, userId, topic, and scheduledAt are required' })

      const session = await prisma.trainingSession.create({
        data: {
          practiceId,
          userId,
          trainerId: trainerId ?? null,
          topic,
          scheduledAt: new Date(scheduledAt),
          notes: notes ?? null,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
          trainer: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      })

      return reply.status(201).send(session)
    }
  )

  // PATCH /api/training/:id
  server.patch<{
    Params: { id: string }
    Body: { completedAt?: string; notes?: string; trainerId?: string; scheduledAt?: string; topic?: string }
  }>(
    '/training/:id',
    async (request, reply) => {
      const { id } = request.params
      const { completedAt, notes, trainerId, scheduledAt, topic } = request.body

      const session = await prisma.trainingSession.update({
        where: { id },
        data: {
          ...(completedAt !== undefined ? { completedAt: new Date(completedAt) } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(trainerId !== undefined ? { trainerId } : {}),
          ...(scheduledAt !== undefined ? { scheduledAt: new Date(scheduledAt) } : {}),
          ...(topic !== undefined ? { topic } : {}),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
          trainer: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      })

      return reply.send(session)
    }
  )

  // DELETE /api/training/:id
  server.delete<{ Params: { id: string } }>(
    '/training/:id',
    async (request, reply) => {
      await prisma.trainingSession.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    }
  )
}
