import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'

export default async function authRoutes(server: FastifyInstance) {
  // POST /api/auth/login
  server.post<{ Body: { email: string; password: string } }>(
    '/auth/login',
    async (request, reply) => {
      const { email, password } = request.body
      if (!email || !password) {
        return reply.status(400).send({ error: 'email and password are required' })
      }

      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      if (user.status === 'terminated' || user.status === 'resigned') {
        return reply.status(403).send({ error: 'Account is no longer active' })
      }

      const requirePasswordChange = user.status === 'invited'

      const token = server.jwt.sign(
        { userId: user.id, practiceId: user.practiceId, role: user.role, email: user.email },
        { expiresIn: '8h' }
      )

      return reply.send({
        token,
        requirePasswordChange,
        user: { id: user.id, practiceId: user.practiceId, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName },
      })
    }
  )

  // GET /api/auth/me — validate token and return user info
  server.get('/auth/me', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { id: true, practiceId: true, role: true, email: true, firstName: true, lastName: true, status: true, seasonedEmployee: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send(user)
  })

  // POST /api/auth/change-password
  server.post<{ Body: { currentPassword: string; newPassword: string } }>(
    '/auth/change-password',
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body
      if (!currentPassword || !newPassword) {
        return reply.status(400).send({ error: 'currentPassword and newPassword are required' })
      }
      if (newPassword.length < 8) {
        return reply.status(400).send({ error: 'New password must be at least 8 characters' })
      }

      const user = await prisma.user.findUnique({ where: { id: request.user.userId } })
      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!valid) {
        return reply.status(401).send({ error: 'Current password is incorrect' })
      }

      const passwordHash = await bcrypt.hash(newPassword, 12)
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: user.status === 'invited' ? 'active' : user.status,
        },
      })

      const token = server.jwt.sign(
        { userId: updated.id, practiceId: updated.practiceId, role: updated.role, email: updated.email },
        { expiresIn: '8h' }
      )

      return reply.send({ token })
    }
  )
}
