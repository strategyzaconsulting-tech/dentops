import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function clockAdjustmentRoutes(server: FastifyInstance) {
  // GET /api/clock-adjustments?practiceId=&userId=
  server.get<{ Querystring: { practiceId: string; userId: string } }>(
    '/clock-adjustments',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      if (!practiceId || !userId) {
        return reply.status(400).send({ error: 'practiceId and userId are required' })
      }
      const adjustments = await prisma.clockAdjustment.findMany({
        where: { practiceId, userId },
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
