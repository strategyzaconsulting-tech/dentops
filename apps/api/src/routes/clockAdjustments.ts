import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function clockAdjustmentRoutes(server: FastifyInstance) {
  // GET /api/clock-adjustments?practiceId=&userId=
  server.get<{ Querystring: { practiceId: string; userId?: string } }>(
    '/clock-adjustments',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      if (!practiceId) return reply.status(400).send({ error: 'practiceId is required' })

      const adjustments = await prisma.clockAdjustment.findMany({
        where: { practiceId, ...(userId ? { userId } : {}) },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(adjustments)
    }
  )

  // POST /api/clock-adjustments
  server.post<{
    Body: {
      practiceId: string
      userId: string
      punchId?: string
      date: string
      type: string
      notes: string
      correctedPunchIn?: string
      correctedPunchOut?: string
    }
  }>('/clock-adjustments', async (request, reply) => {
    const { practiceId, userId, punchId, date, type, notes, correctedPunchIn, correctedPunchOut } = request.body
    const adjustment = await prisma.clockAdjustment.create({
      data: {
        practiceId,
        userId,
        punchId: punchId ?? null,
        date: new Date(date),
        type,
        notes,
        correctedPunchIn: correctedPunchIn ? new Date(correctedPunchIn) : null,
        correctedPunchOut: correctedPunchOut ? new Date(correctedPunchOut) : null,
      },
    })
    return reply.status(201).send(adjustment)
  })

  // PATCH /api/clock-adjustments/:id — approve or deny
  server.patch<{
    Params: { id: string }
    Body: { status: 'approved' | 'denied'; reviewNotes?: string }
  }>(
    '/clock-adjustments/:id',
    async (request, reply) => {
      const { id } = request.params
      const { status, reviewNotes } = request.body

      if (!['approved', 'denied'].includes(status)) {
        return reply.status(400).send({ error: 'status must be approved or denied' })
      }

      const adjustment = await prisma.clockAdjustment.update({
        where: { id },
        data: {
          status,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes ?? null,
        },
        include: { user: { select: { firstName: true, lastName: true } } },
      })

      // On approval: apply corrected times to the linked punch
      if (status === 'approved' && adjustment.punchId) {
        const punchUpdate: Record<string, Date> = {}
        if (adjustment.correctedPunchIn) punchUpdate.punchIn = adjustment.correctedPunchIn
        if (adjustment.correctedPunchOut) punchUpdate.punchOut = adjustment.correctedPunchOut

        if (Object.keys(punchUpdate).length > 0) {
          await prisma.timePunch.update({
            where: { id: adjustment.punchId },
            data: punchUpdate,
          })
        }
      }

      return reply.send(adjustment)
    }
  )
}
