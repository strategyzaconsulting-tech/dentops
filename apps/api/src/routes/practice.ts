import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function practiceRoutes(server: FastifyInstance) {
  server.get<{ Params: { id: string } }>('/practice/:id', async (request, reply) => {
    const { id } = request.params
    const practice = await prisma.practice.findUnique({ where: { id } })
    if (!practice) return reply.status(404).send({ error: 'Practice not found' })
    return reply.send(practice)
  })

  server.patch<{ Params: { id: string }; Body: { requireSpecialty?: boolean } }>(
    '/practice/:id',
    async (request, reply) => {
      const { id } = request.params
      const { requireSpecialty } = request.body
      const practice = await prisma.practice.update({
        where: { id },
        data: { ...(requireSpecialty !== undefined && { requireSpecialty }) },
      })
      return reply.send(practice)
    }
  )
}
