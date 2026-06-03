import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function clockAdjustmentRoutes(server: FastifyInstance) {
  // GET /api/clock-adjustments?practiceId=&userId= (userId optional — omit for admin view of all)
  server.get<{ Querystring: { practiceId: string; userId?: string } }>(
    '/clock-adjustments',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      if (!practiceId) {
        return reply.status(400).send({ error: 'practiceId is required' })
      }
      const adjustments = await prisma.clockAdjustment.findMany({
        where: { practiceId, ...(userId ? { userId } : {}) },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(adjustments)
    }
  )

  // PATCH /api/clock-adjustments/:id — approve or deny
  server.patch<{ Params: { id: string }; Body: { status: 'approved' | 'denied' } }>(
    '/clock-adjustments/:id',
    async (request, reply) => {
      const { id } = request.params
      const { status } = request.body
      if (!['approved', 'denied'].includes(status)) {
        return reply.status(400).send({ error: 'status must be approved or denied' })
      }
      const adjustment = await prisma.clockAdjustment.update({
        where: { id },
        data: { status },
        include: { user: { select: { firstName: true, lastName: true } } },
      })
      return reply.send(adjustment)
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
    }
  }>('/clock-adjustments', async (request, reply) => {
    const { practiceId, userId, punchId, date, type, notes } = request.body
    const adjustment = await prisma.clockAdjustment.create({
      data: {
        practiceId,
        userId,
        punchId: punchId ?? null,
        date: new Date(date),
        type,
        notes,
      },
    })
    return reply.status(201).send(adjustment)
  })
}
