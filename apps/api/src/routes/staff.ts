import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'

const userSelect = {
  id: true, practiceId: true, firstName: true, lastName: true, email: true,
  role: true, status: true, shiftStart: true, shiftEnd: true, hireDate: true,
  managerId: true, separationDate: true, phone: true, address: true,
  probationDays: true, probationEndDate: true, probationStatus: true,
  probationNotes: true, probationCompletedAt: true, probationAlertDays: true,
  benefitsEligibleAt: true, ptoDaysPerYear: true, seasonedEmployee: true,
  pushToken: true,
} as const

export default async function staffRoutes(server: FastifyInstance) {
  // GET /api/staff?practiceId=
  server.get<{ Querystring: { practiceId: string } }>('/staff', async (request, reply) => {
    const { practiceId } = request.query
    if (!practiceId) {
      return reply.status(400).send({ error: 'practiceId is required' })
    }
    const staff = await prisma.user.findMany({
      where: { practiceId },
      select: userSelect,
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
      tempPassword?: string
    }
  }>('/staff', async (request, reply) => {
    const { practiceId, firstName, lastName, email, role, tempPassword } = request.body
    if (!tempPassword || tempPassword.length < 8) {
      return reply.status(400).send({ error: 'tempPassword must be at least 8 characters' })
    }
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    const user = await prisma.user.create({
      data: { practiceId, firstName, lastName, email, role, status: 'invited', passwordHash },
      select: userSelect,
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
      ptoDaysPerYear?: number | null
      seasonedEmployee?: boolean
      tempPassword?: string
    }
  }>('/staff/:id', async (request, reply) => {
    const { id } = request.params
    const {
      firstName, lastName, email, role, status, shiftStart, shiftEnd,
      hireDate, managerId, separationDate, phone, address,
      probationDays, probationEndDate, probationStatus, probationNotes,
      probationCompletedAt, probationAlertDays, benefitsEligibleAt,
      ptoDaysPerYear, seasonedEmployee, tempPassword,
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
    if (ptoDaysPerYear !== undefined) data.ptoDaysPerYear = ptoDaysPerYear ?? null
    if (seasonedEmployee !== undefined) data.seasonedEmployee = seasonedEmployee
    if (tempPassword) data.passwordHash = await bcrypt.hash(tempPassword, 12)

    const user = await prisma.user.update({ where: { id }, data, select: userSelect })
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
          status: 'active',
          OR: [{ probationStatus: 'active' }, { probationStatus: null }],
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
