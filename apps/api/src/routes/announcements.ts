import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function announcementRoutes(server: FastifyInstance) {
  // GET /api/announcements?practiceId=
  server.get<{ Querystring: { practiceId: string } }>(
    '/announcements',
    async (request, reply) => {
      const { practiceId } = request.query
      if (!practiceId) return reply.status(400).send({ error: 'practiceId is required' })

      const announcements = await prisma.announcement.findMany({
        where: { practiceId },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(announcements)
    }
  )

  // POST /api/announcements
  server.post<{ Body: { practiceId: string; title: string; body: string } }>(
    '/announcements',
    async (request, reply) => {
      const { practiceId, title, body } = request.body
      if (!practiceId || !title || !body) {
        return reply.status(400).send({ error: 'practiceId, title, and body are required' })
      }
      const announcement = await prisma.announcement.create({
        data: { practiceId, title, body },
      })
      return reply.status(201).send(announcement)
    }
  )

  // DELETE /api/announcements/:id
  server.delete<{ Params: { id: string } }>(
    '/announcements/:id',
    async (request, reply) => {
      await prisma.announcement.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    }
  )
}
