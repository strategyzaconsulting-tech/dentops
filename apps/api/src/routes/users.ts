import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function userRoutes(server: FastifyInstance) {
  // PATCH /api/users/push-token — register or update a device push token
  server.patch<{
    Body: { userId: string; practiceId: string; token: string }
  }>('/users/push-token', async (request, reply) => {
    const { userId, practiceId, token } = request.body
    if (!userId || !practiceId || !token) {
      return reply.status(400).send({ error: 'userId, practiceId, and token are required' })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { pushToken: token },
    })

    return reply.status(200).send({ ok: true })
  })
}
