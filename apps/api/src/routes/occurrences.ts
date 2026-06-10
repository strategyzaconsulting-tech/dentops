import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function occurrenceRoutes(server: FastifyInstance) {
  // GET /api/occurrences?practiceId=&userId=
  server.get<{ Querystring: { practiceId: string; userId?: string } }>(
    '/occurrences',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      if (!practiceId) {
        return reply.status(400).send({ error: 'practiceId is required' })
      }

      const occurrences = await prisma.employeeOccurrence.findMany({
        where: {
          practiceId,
          ...(userId ? { userId } : {}),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      })

      return reply.send(occurrences)
    }
  )

  // POST /api/occurrences — manual entry by admin
  server.post<{
    Body: { practiceId: string; userId: string; date: string; type: string; notes?: string }
  }>('/occurrences', async (request, reply) => {
    const { practiceId, userId, date, type, notes } = request.body
    if (!practiceId || !userId || !date || !type) {
      return reply.status(400).send({ error: 'practiceId, userId, date, and type are required' })
    }

    const occurrence = await prisma.employeeOccurrence.upsert({
      where: { userId_date_type: { userId, date: new Date(date), type } },
      create: { practiceId, userId, date: new Date(date), type, notes: notes ?? null },
      update: { notes: notes ?? undefined },
    })

    return reply.status(201).send(occurrence)
  })
}
