import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function w4ReviewRoutes(server: FastifyInstance) {
  // GET /api/w4-review/status?practiceId=&userId=&year=
  server.get<{ Querystring: { practiceId: string; userId: string; year?: string } }>(
    '/w4-review/status',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      const year = request.query.year ? parseInt(request.query.year, 10) : new Date().getFullYear()
      if (!practiceId || !userId)
        return reply.status(400).send({ error: 'practiceId and userId are required' })

      const review = await prisma.w4AnnualReview.findUnique({
        where: { userId_year: { userId, year } },
      })

      return reply.send({
        year,
        required: true,
        completed: !!review?.completedAt,
        completedAt: review?.completedAt ?? null,
        changed: review?.changed ?? false,
      })
    }
  )

  // POST /api/w4-review/complete
  server.post<{ Body: { practiceId: string; userId: string; changed?: boolean } }>(
    '/w4-review/complete',
    async (request, reply) => {
      const { practiceId, userId, changed = false } = request.body
      if (!practiceId || !userId)
        return reply.status(400).send({ error: 'practiceId and userId are required' })

      const year = new Date().getFullYear()
      const review = await prisma.w4AnnualReview.upsert({
        where: { userId_year: { userId, year } },
        create: { practiceId, userId, year, completedAt: new Date(), changed },
        update: { completedAt: new Date(), changed },
      })

      return reply.send(review)
    }
  )
}
