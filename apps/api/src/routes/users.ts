import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function userRoutes(server: FastifyInstance) {
  // PATCH /api/users/push-token — register or update your own device push token
  server.patch<{
    Body: { token: string }
  }>('/users/push-token', async (request, reply) => {
    const { token } = request.body
    if (!token) {
      return reply.status(400).send({ error: 'token is required' })
    }

    // userId and practiceId come from the verified JWT — cannot be spoofed
    await prisma.user.update({
      where: { id: request.user.userId, practiceId: request.user.practiceId },
      data: { pushToken: token },
    })

    return reply.status(200).send({ ok: true })
  })
}
