import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'

async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.user.role !== 'super_admin') {
    return reply.status(403).send({ error: 'Forbidden' })
  }
}

export default async function adminRoutes(server: FastifyInstance) {
  // POST /api/admin/super-admin — bootstrap a super admin account
  // Protected by SUPER_ADMIN_BOOTSTRAP_KEY env var, not by JWT auth
  server.post<{
    Body: { email: string; password: string; firstName: string; lastName: string }
  }>('/admin/super-admin', async (request, reply) => {
    const bootstrapKey = process.env.SUPER_ADMIN_BOOTSTRAP_KEY
    if (!bootstrapKey) {
      return reply.status(503).send({ error: 'Super admin bootstrap is not configured' })
    }

    const authHeader = request.headers.authorization ?? ''
    const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (provided !== bootstrapKey) {
      return reply.status(401).send({ error: 'Invalid bootstrap key' })
    }

    const existing = await prisma.user.findFirst({ where: { role: 'super_admin' } })
    if (existing) {
      return reply.status(409).send({ error: 'A super admin already exists' })
    }

    const { email, password, firstName, lastName } = request.body
    if (!email || !password || !firstName || !lastName) {
      return reply.status(400).send({ error: 'email, password, firstName, lastName are required' })
    }
    if (password.length < 8) {
      return reply.status(400).send({ error: 'password must be at least 8 characters' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        practiceId: null,
        firstName,
        lastName,
        email: email.toLowerCase().trim(),
        role: 'super_admin',
        status: 'active',
        passwordHash,
      },
    })

    return reply.status(201).send({ id: user.id, email: user.email, role: user.role })
  })

  // GET /api/admin/practices — list all practices with stats
  server.get('/admin/practices', { preHandler: requireSuperAdmin }, async (_request, reply) => {
    const practices = await prisma.practice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, locations: true } },
      },
    })

    return reply.send(
      practices.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        brandColor: p.brandColor,
        createdAt: p.createdAt,
        userCount: p._count.users,
        locationCount: p._count.locations,
      }))
    )
  })
}
