import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function openShiftRoutes(server: FastifyInstance) {
  // GET /api/open-shifts?practiceId=&status= (status optional, default 'open')
  server.get<{ Querystring: { practiceId: string; status?: string } }>(
    '/open-shifts',
    async (request, reply) => {
      const { practiceId, status } = request.query
      if (!practiceId) return reply.status(400).send({ error: 'practiceId is required' })

      const shifts = await prisma.openShift.findMany({
        where: { practiceId, ...(status ? { status } : {}) },
        include: {
          location: { select: { id: true, name: true } },
          claims: {
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      })
      return reply.send(shifts)
    }
  )

  // POST /api/open-shifts
  server.post<{
    Body: {
      practiceId: string
      locationId: string
      date: string
      startTime: string
      endTime: string
      specialty?: string
      notes?: string
    }
  }>('/open-shifts', async (request, reply) => {
    const { practiceId, locationId, date, startTime, endTime, specialty, notes } = request.body
    const shift = await prisma.openShift.create({
      data: { practiceId, locationId, date: new Date(date), startTime, endTime, specialty: specialty ?? null, notes: notes ?? null },
      include: {
        location: { select: { id: true, name: true } },
        claims: [],
      },
    })
    return reply.status(201).send(shift)
  })

  // PATCH /api/open-shifts/:id (cancel)
  server.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/open-shifts/:id',
    async (request, reply) => {
      const shift = await prisma.openShift.update({
        where: { id: request.params.id },
        data: { status: request.body.status },
        include: { location: { select: { id: true, name: true } }, claims: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
      })
      return reply.send(shift)
    }
  )

  // DELETE /api/open-shifts/:id
  server.delete<{ Params: { id: string } }>('/open-shifts/:id', async (request, reply) => {
    await prisma.openShift.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  // POST /api/open-shifts/:id/claim — staff claims a shift
  server.post<{ Params: { id: string }; Body: { practiceId: string; userId: string } }>(
    '/open-shifts/:id/claim',
    async (request, reply) => {
      const { practiceId, userId } = request.body
      const existing = await prisma.openShiftClaim.findFirst({
        where: { openShiftId: request.params.id, userId },
      })
      if (existing) return reply.status(409).send({ error: 'Already claimed' })

      const claim = await prisma.openShiftClaim.create({
        data: { openShiftId: request.params.id, practiceId, userId },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      })
      return reply.status(201).send(claim)
    }
  )

  // PATCH /api/open-shifts/claims/:id — admin approves or denies
  server.patch<{ Params: { id: string }; Body: { status: 'approved' | 'denied' } }>(
    '/open-shifts/claims/:id',
    async (request, reply) => {
      const { status } = request.body
      const claim = await prisma.openShiftClaim.update({
        where: { id: request.params.id },
        data: { status },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          openShift: true,
        },
      })

      if (status === 'approved') {
        // Mark the open shift as filled and create a regular shift
        await prisma.openShift.update({ where: { id: claim.openShiftId }, data: { status: 'filled' } })
        await prisma.shift.create({
          data: {
            practiceId: claim.openShift.practiceId,
            userId: claim.userId,
            locationId: claim.openShift.locationId,
            date: claim.openShift.date,
            startTime: claim.openShift.startTime,
            endTime: claim.openShift.endTime,
            specialty: claim.openShift.specialty ?? null,
            notes: claim.openShift.notes ?? null,
          },
        })
      }

      return reply.send(claim)
    }
  )

  // GET /api/open-shifts/claims?practiceId=&userId=
  server.get<{ Querystring: { practiceId: string; userId: string } }>(
    '/open-shifts/claims',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      if (!practiceId || !userId) return reply.status(400).send({ error: 'practiceId and userId are required' })
      const claims = await prisma.openShiftClaim.findMany({
        where: { practiceId, userId },
        include: {
          openShift: { include: { location: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(claims)
    }
  )
}
