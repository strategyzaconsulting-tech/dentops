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
      probationDays?: number | null
      probationEndDate?: string | null
      probationStatus?: string | null
      probationNotes?: string | null
      probationCompletedAt?: string | null
      probationAlertDays?: number | null
      benefitsEligibleAt?: string | null
    }
  }>('/staff/:id', async (request, reply) => {
    const { id } = request.params
    const {
      firstName, lastName, email, role, status, shiftStart, shiftEnd,
      hireDate, managerId, separationDate, phone, address,
      probationDays, probationEndDate, probationStatus, probationNotes,
      probationCompletedAt, probationAlertDays, benefitsEligibleAt,
    } = request.body

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
    if (probationDays !== undefined) data.probationDays = probationDays ?? null
    if (probationEndDate !== undefined) data.probationEndDate = probationEndDate ? new Date(probationEndDate) : null
    if (probationStatus !== undefined) data.probationStatus = probationStatus || null
    if (probationNotes !== undefined) data.probationNotes = probationNotes || null
    if (probationCompletedAt !== undefined) data.probationCompletedAt = probationCompletedAt ? new Date(probationCompletedAt) : null
    if (probationAlertDays !== undefined) data.probationAlertDays = probationAlertDays ?? null
    if (benefitsEligibleAt !== undefined) data.benefitsEligibleAt = benefitsEligibleAt ? new Date(benefitsEligibleAt) : null

    const user = await prisma.user.update({ where: { id }, data })
    return reply.send(user)
  })

  // GET /api/staff/probation-alerts?practiceId=
  server.get<{ Querystring: { practiceId: string } }>(
    '/staff/probation-alerts',
    async (request, reply) => {
      const { practiceId } = request.query
      if (!practiceId) return reply.status(400).send({ error: 'practiceId is required' })

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const staff = await prisma.user.findMany({
        where: {
          practiceId,
          probationEndDate: { not: null },
          probationStatus: { in: ['active', null] },
          status: 'active',
        },
        select: {
          id: true, firstName: true, lastName: true, role: true,
          hireDate: true, probationDays: true, probationEndDate: true,
          probationStatus: true, probationAlertDays: true,
        },
      })

      const alerts = staff
        .filter(s => s.probationEndDate)
        .map(s => {
          const end = new Date(s.probationEndDate!)
          end.setHours(0, 0, 0, 0)
          const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000)
          const alertDays = s.probationAlertDays ?? 14
          return { ...s, daysLeft, alertDays }
        })
        .filter(s => s.daysLeft <= s.alertDays)
        .sort((a, b) => a.daysLeft - b.daysLeft)

      return reply.send(alerts)
    }
  )
}
