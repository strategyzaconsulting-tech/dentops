import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { sendExpoPushNotifications } from '../lib/expoPush.js'

export default async function licenseRoutes(server: FastifyInstance) {
  // GET /api/licenses?userId=  — all licenses for a staff member
  server.get<{ Querystring: { userId: string } }>(
    '/licenses',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const { userId } = request.query
      if (!userId) return reply.status(400).send({ error: 'userId is required' })

      const licenses = await prisma.license.findMany({
        where: { practiceId, userId },
        orderBy: [{ expirationDate: 'asc' }, { type: 'asc' }],
      })
      return reply.send(licenses)
    }
  )

  // GET /api/licenses/expiring?days=30  — all licenses expiring within N days across practice
  server.get<{ Querystring: { days?: string } }>(
    '/licenses/expiring',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const days = parseInt(request.query.days ?? '30', 10)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const cutoff = new Date(today)
      cutoff.setDate(cutoff.getDate() + days)

      const licenses = await prisma.license.findMany({
        where: {
          practiceId,
          expirationDate: { not: null, lte: cutoff },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true, pushToken: true } },
        },
        orderBy: { expirationDate: 'asc' },
      })

      const result = licenses.map(l => {
        const exp = new Date(l.expirationDate!)
        exp.setHours(0, 0, 0, 0)
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000)
        return { ...l, daysLeft }
      })

      return reply.send(result)
    }
  )

  // ─── Document endpoints ───────────────────────────────────────────────────────

  // GET /api/license-documents?licenseId=  — list docs (no binary data)
  server.get<{ Querystring: { licenseId: string } }>(
    '/license-documents',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const { licenseId } = request.query
      if (!licenseId) return reply.status(400).send({ error: 'licenseId is required' })

      const docs = await prisma.licenseDocument.findMany({
        where: { licenseId, practiceId },
        select: { id: true, fileName: true, fileSize: true, mimeType: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
      return reply.send(docs)
    }
  )

  // POST /api/license-documents  — upload (base64)
  server.post<{
    Body: { licenseId: string; userId: string; fileName: string; mimeType: string; fileDataBase64: string }
  }>('/license-documents', async (request, reply) => {
    const practiceId = request.user.practiceId
    const { licenseId, userId, fileName, mimeType, fileDataBase64 } = request.body

    if (!licenseId || !userId || !fileName || !mimeType || !fileDataBase64) {
      return reply.status(400).send({ error: 'licenseId, userId, fileName, mimeType, fileDataBase64 are required' })
    }

    // Verify license belongs to this practice
    const license = await prisma.license.findUnique({ where: { id: licenseId }, select: { practiceId: true } })
    if (!license || license.practiceId !== practiceId) {
      return reply.status(404).send({ error: 'License not found' })
    }

    const fileBuffer = Buffer.from(fileDataBase64, 'base64')
    const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
    if (fileBuffer.length > MAX_BYTES) {
      return reply.status(413).send({ error: 'File exceeds 10 MB limit' })
    }

    const doc = await prisma.licenseDocument.create({
      data: {
        licenseId, practiceId, userId,
        fileName,
        fileSize: fileBuffer.length,
        mimeType,
        fileData: fileBuffer,
      },
      select: { id: true, fileName: true, fileSize: true, mimeType: true, createdAt: true },
    })
    return reply.status(201).send(doc)
  })

  // GET /api/license-documents/:id/download
  server.get<{ Params: { id: string } }>(
    '/license-documents/:id/download',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const { id } = request.params

      const doc = await prisma.licenseDocument.findUnique({ where: { id } })
      if (!doc || doc.practiceId !== practiceId) {
        return reply.status(404).send({ error: 'Not found' })
      }

      return reply.send({
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        fileDataBase64: Buffer.from(doc.fileData).toString('base64'),
      })
    }
  )

  // DELETE /api/license-documents/:id
  server.delete<{ Params: { id: string } }>(
    '/license-documents/:id',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const { id } = request.params

      const doc = await prisma.licenseDocument.findUnique({ where: { id }, select: { practiceId: true } })
      if (!doc || doc.practiceId !== practiceId) {
        return reply.status(404).send({ error: 'Not found' })
      }
      await prisma.licenseDocument.delete({ where: { id } })
      return reply.status(204).send()
    }
  )

  // ─── License CRUD ─────────────────────────────────────────────────────────────

  // GET /api/licenses/compliance  — doctors missing active malpractice insurance
  server.get(
    '/licenses/compliance',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const today = new Date(); today.setHours(0, 0, 0, 0)

      const doctors = await prisma.user.findMany({
        where: { practiceId, role: 'doctor', status: { in: ['active', 'on_leave'] } },
        select: { id: true, firstName: true, lastName: true, role: true },
      })

      const malpractice = await prisma.license.findMany({
        where: { practiceId, type: 'malpractice' },
        select: { userId: true, expirationDate: true },
      })

      // A doctor is compliant if they have at least one malpractice license that isn't expired
      const covered = new Set(
        malpractice
          .filter(l => !l.expirationDate || new Date(l.expirationDate) >= today)
          .map(l => l.userId)
      )

      const missing = doctors.filter(d => !covered.has(d.id))
      return reply.send(missing)
    }
  )

  // POST /api/licenses
  server.post<{
    Body: {
      userId: string
      type: string
      label?: string
      licenseNumber?: string
      state?: string
      issuedDate?: string
      expirationDate?: string
      notes?: string
      alertDays?: number
      insuranceCarrier?: string
      coverageAmount?: string
    }
  }>('/licenses', async (request, reply) => {
    const practiceId = request.user.practiceId
    const { userId, type, label, licenseNumber, state, issuedDate, expirationDate, notes, alertDays, insuranceCarrier, coverageAmount } = request.body

    if (!userId || !type) return reply.status(400).send({ error: 'userId and type are required' })

    const license = await prisma.license.create({
      data: {
        practiceId,
        userId,
        type,
        label: label ?? null,
        licenseNumber: licenseNumber ?? null,
        state: state ?? null,
        issuedDate: issuedDate ? new Date(issuedDate) : null,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        notes: notes ?? null,
        alertDays: alertDays ?? 30,
        insuranceCarrier: insuranceCarrier ?? null,
        coverageAmount: coverageAmount ?? null,
      },
    })

    // Send push alert if expiring within alertDays
    await maybeNotify(license.id, practiceId, userId, alertDays ?? 30)

    return reply.status(201).send(license)
  })

  // PATCH /api/licenses/:id
  server.patch<{
    Params: { id: string }
    Body: {
      type?: string
      label?: string | null
      licenseNumber?: string | null
      state?: string | null
      issuedDate?: string | null
      expirationDate?: string | null
      notes?: string | null
      alertDays?: number
      insuranceCarrier?: string | null
      coverageAmount?: string | null
    }
  }>('/licenses/:id', async (request, reply) => {
    const practiceId = request.user.practiceId
    const { id } = request.params

    const existing = await prisma.license.findUnique({ where: { id }, select: { practiceId: true, userId: true } })
    if (!existing || existing.practiceId !== practiceId) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const { type, label, licenseNumber, state, issuedDate, expirationDate, notes, alertDays, insuranceCarrier, coverageAmount } = request.body
    const data: Record<string, unknown> = {}
    if (type !== undefined) data.type = type
    if (label !== undefined) data.label = label ?? null
    if (licenseNumber !== undefined) data.licenseNumber = licenseNumber ?? null
    if (state !== undefined) data.state = state ?? null
    if (issuedDate !== undefined) data.issuedDate = issuedDate ? new Date(issuedDate) : null
    if (expirationDate !== undefined) data.expirationDate = expirationDate ? new Date(expirationDate) : null
    if (notes !== undefined) data.notes = notes ?? null
    if (alertDays !== undefined) data.alertDays = alertDays
    if (insuranceCarrier !== undefined) data.insuranceCarrier = insuranceCarrier ?? null
    if (coverageAmount !== undefined) data.coverageAmount = coverageAmount ?? null

    const license = await prisma.license.update({ where: { id }, data })

    await maybeNotify(id, practiceId, existing.userId, license.alertDays)

    return reply.send(license)
  })

  // DELETE /api/licenses/:id
  server.delete<{ Params: { id: string } }>(
    '/licenses/:id',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const { id } = request.params

      const existing = await prisma.license.findUnique({ where: { id }, select: { practiceId: true } })
      if (!existing || existing.practiceId !== practiceId) {
        return reply.status(404).send({ error: 'Not found' })
      }

      await prisma.license.delete({ where: { id } })
      return reply.status(204).send()
    }
  )
}

// Send a push notification to the staff member if their license is expiring within alertDays
async function maybeNotify(licenseId: string, practiceId: string, userId: string, alertDays: number) {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    select: { expirationDate: true, type: true, label: true },
  })
  if (!license?.expirationDate) return

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(license.expirationDate)
  exp.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000)

  if (daysLeft > alertDays || daysLeft < 0) return

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } })
  if (!user?.pushToken) return

  const typeName = license.label ?? LICENSE_TYPE_LABELS[license.type] ?? license.type
  const msg = daysLeft <= 0
    ? `Your ${typeName} has expired. Please renew immediately.`
    : `Your ${typeName} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`

  await sendExpoPushNotifications(
    [user.pushToken],
    'License Expiring Soon',
    msg,
    { screen: 'licenses', licenseId }
  ).catch(() => {})
}

const LICENSE_TYPE_LABELS: Record<string, string> = {
  dental_license: 'Dental License',
  da_certification: 'DA Certification',
  rdh_license: 'RDH License',
  caqh: 'CAQH Number',
  dea: 'DEA Number',
  npi: 'NPI Number',
  cpr: 'CPR / BLS Card',
  xray: 'X-Ray Certificate',
  other: 'License',
}
