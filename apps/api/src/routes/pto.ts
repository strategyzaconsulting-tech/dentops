import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

const ALLOCATIONS: Record<string, number> = {
  vacation: 15,
  sick: 10,
  personal: 5,
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
}

export default async function ptoRoutes(server: FastifyInstance) {
  // GET /api/pto/balance?practiceId=&userId=
  server.get<{ Querystring: { practiceId: string; userId: string } }>(
    '/pto/balance',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      if (!practiceId || !userId) {
        return reply.status(400).send({ error: 'practiceId and userId are required' })
      }

      const yearStart = new Date(new Date().getFullYear(), 0, 1)
      const yearEnd = new Date(new Date().getFullYear(), 11, 31)

      const approved = await prisma.ptoRequest.findMany({
        where: {
          practiceId,
          userId,
          status: 'approved',
          startDate: { gte: yearStart },
          endDate: { lte: yearEnd },
        },
      })

      const used: Record<string, number> = { vacation: 0, sick: 0, personal: 0 }
      for (const req of approved) {
        if (used[req.type] !== undefined) {
          used[req.type] += daysBetween(req.startDate, req.endDate)
        }
      }

      const balance = Object.fromEntries(
        Object.entries(ALLOCATIONS).map(([type, total]) => [
          type,
          { total, used: used[type] ?? 0, remaining: total - (used[type] ?? 0) },
        ])
      )

      return reply.send(balance)
    }
  )

  // GET /api/pto/requests?practiceId=&status=&userId=
  server.get<{ Querystring: { practiceId: string; status?: string; userId?: string } }>(
    '/pto/requests',
    async (request, reply) => {
      const { practiceId, status, userId } = request.query
      if (!practiceId) {
        return reply.status(400).send({ error: 'practiceId is required' })
      }

      const where: Record<string, unknown> = { practiceId }
      if (status) where.status = status
      if (userId) where.userId = userId

      const requests = await prisma.ptoRequest.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { startDate: 'asc' },
      })
      return reply.send(requests)
    }
  )

  // POST /api/pto/requests
  server.post<{
    Body: {
      practiceId: string
      userId: string
      startDate: string
      endDate: string
      type: string
      notes?: string
    }
  }>('/pto/requests', async (request, reply) => {
    const { practiceId, userId, startDate, endDate, type, notes } = request.body

    const start = new Date(startDate)
    const end = new Date(endDate)

    const blackouts = await prisma.blackoutDate.findMany({
      where: {
        practiceId,
        date: { gte: start, lte: end },
      },
    })

    if (blackouts.length > 0) {
      return reply.status(409).send({
        error: 'Request overlaps with blackout dates',
        blackoutDates: blackouts.map((b) => b.date),
      })
    }

    const req = await prisma.ptoRequest.create({
      data: {
        practiceId,
        userId,
        startDate: start,
        endDate: end,
        type,
        status: 'pending',
        notes: notes ?? null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    return reply.status(201).send(req)
  })

  // PATCH /api/pto/requests/:id
  server.patch<{
    Params: { id: string }
    Body: { status: string }
  }>('/pto/requests/:id', async (request, reply) => {
    const { id } = request.params
    const { status } = request.body

    if (!['approved', 'denied', 'pending'].includes(status)) {
      return reply.status(400).send({ error: 'Invalid status' })
    }

    const req = await prisma.ptoRequest.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    return reply.send(req)
  })

  // GET /api/pto/team-calendar?practiceId=
  server.get<{ Querystring: { practiceId: string } }>(
    '/pto/team-calendar',
    async (request, reply) => {
      const { practiceId } = request.query
      if (!practiceId) {
        return reply.status(400).send({ error: 'practiceId is required' })
      }

      const requests = await prisma.ptoRequest.findMany({
        where: { practiceId, status: 'approved' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { startDate: 'asc' },
      })
      return reply.send(requests)
    }
  )

  // GET /api/pto/blackout-dates?practiceId=
  server.get<{ Querystring: { practiceId: string } }>(
    '/pto/blackout-dates',
    async (request, reply) => {
      const { practiceId } = request.query
      if (!practiceId) {
        return reply.status(400).send({ error: 'practiceId is required' })
      }
      const dates = await prisma.blackoutDate.findMany({
        where: { practiceId },
        orderBy: { date: 'asc' },
      })
      return reply.send(dates)
    }
  )

  // POST /api/pto/blackout-dates
  server.post<{
    Body: { practiceId: string; date: string; reason?: string }
  }>('/pto/blackout-dates', async (request, reply) => {
    const { practiceId, date, reason } = request.body
    const d = await prisma.blackoutDate.create({
      data: {
        practiceId,
        date: new Date(date),
        reason: reason ?? null,
      },
    })
    return reply.status(201).send(d)
  })

  // DELETE /api/pto/blackout-dates/:id
  server.delete<{ Params: { id: string } }>(
    '/pto/blackout-dates/:id',
    async (request, reply) => {
      const { id } = request.params
      await prisma.blackoutDate.delete({ where: { id } })
      return reply.status(204).send()
    }
  )
}
