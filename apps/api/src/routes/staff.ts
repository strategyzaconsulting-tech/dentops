import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function staffRoutes(server: FastifyInstance) {
  // GET /api/staff?practiceId=
  server.get<{ Querystring: { practiceId: string } }>('/staff', async (request, reply) => {
    const { practiceId } = request.query
    if (!practiceId) {
      return reply.status(400).send({ error: 'practiceId is required' })
    }
    const staff = await prisma.user.findMany({
      where: { practiceId },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    })
    return reply.send(staff)
  })

  // POST /api/staff
  server.post<{
    Body: {
      practiceId: string
      firstName: string
      lastName: string
      email: string
      role: string
    }
  }>('/staff', async (request, reply) => {
    const { practiceId, firstName, lastName, email, role } = request.body
    const user = await prisma.user.create({
      data: { practiceId, firstName, lastName, email, role, status: 'active' },
    })
    return reply.status(201).send(user)
  })

  // PATCH /api/staff/:id
  server.patch<{
    Params: { id: string }
    Body: {
      firstName?: string
      lastName?: string
      email?: string
      role?: string
      status?: string
      shiftStart?: string | null
      shiftEnd?: string | null
      hireDate?: string | null
      managerId?: string | null
      separationDate?: string | null
      phone?: string | null
      address?: string | null
    }
  }>('/staff/:id', async (request, reply) => {
    const { id } = request.params
    const { firstName, lastName, email, role, status, shiftStart, shiftEnd, hireDate, managerId, separationDate, phone, address } = request.body

    const data: Record<string, unknown> = {}
    if (firstName !== undefined) data.firstName = firstName
    if (lastName !== undefined) data.lastName = lastName
    if (email !== undefined) data.email = email
    if (role !== undefined) data.role = role
    if (status !== undefined) data.status = status
    if (shiftStart !== undefined) data.shiftStart = shiftStart || null
    if (shiftEnd !== undefined) data.shiftEnd = shiftEnd || null
    if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null
    if (managerId !== undefined) data.managerId = managerId || null
    if (separationDate !== undefined) data.separationDate = separationDate ? new Date(separationDate) : null
    if (phone !== undefined) data.phone = phone || null
    if (address !== undefined) data.address = address || null

    const user = await prisma.user.update({ where: { id }, data })
    return reply.send(user)
  })
}
