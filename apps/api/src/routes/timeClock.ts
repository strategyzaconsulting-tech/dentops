import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function timeclockRoutes(server: FastifyInstance) {
  // GET /api/locations?practiceId=...
  server.get<{ Querystring: { practiceId: string } }>('/locations', async (request, reply) => {
    const { practiceId } = request.query
    if (!practiceId) {
      return reply.status(400).send({ error: 'practiceId is required' })
    }
    const locations = await prisma.location.findMany({
      where: { practiceId },
    })
    return reply.send(locations)
  })

  // POST /api/time-punches
  server.post<{
    Body: {
      practiceId: string
      userId: string
      locationId: string
      specialty?: string
      punchIn: string
    }
  }>('/time-punches', async (request, reply) => {
    const { practiceId, userId, locationId, specialty, punchIn } = request.body
    const punch = await prisma.timePunch.create({
      data: {
        practiceId,
        userId,
        locationId,
        specialty: specialty ?? null,
        punchIn: new Date(punchIn),
      },
    })
    return reply.status(201).send(punch)
  })

  // PATCH /api/time-punches/:id
  server.patch<{
    Params: { id: string }
    Body: {
      punchOut?: string
      breakStart?: string
      breakEnd?: string
      punchIn?: string
      locationId?: string
      specialty?: string
    }
  }>('/time-punches/:id', async (request, reply) => {
    const { id } = request.params
    const { punchOut, breakStart, breakEnd, punchIn, locationId, specialty } = request.body

    const data: Record<string, unknown> = {}
    if (punchOut !== undefined) data.punchOut = new Date(punchOut)
    if (breakStart !== undefined) data.breakStart = new Date(breakStart)
    if (breakEnd !== undefined) data.breakEnd = new Date(breakEnd)
    if (punchIn !== undefined) data.punchIn = new Date(punchIn)
    if (locationId !== undefined) data.locationId = locationId
    if (specialty !== undefined) data.specialty = specialty

    const punch = await prisma.timePunch.update({
      where: { id },
      data,
    })
    return reply.send(punch)
  })

  // GET /api/time-punches/live?practiceId=...
  server.get<{ Querystring: { practiceId: string } }>('/time-punches/live', async (request, reply) => {
    const { practiceId } = request.query
    if (!practiceId) {
      return reply.status(400).send({ error: 'practiceId is required' })
    }
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const punches = await prisma.timePunch.findMany({
      where: {
        practiceId,
        punchOut: null,
        punchIn: { gte: start, lte: end },
      },
      select: {
        id: true,
        userId: true,
        user: { select: { firstName: true, lastName: true } },
        locationId: true,
        location: { select: { name: true } },
        specialty: true,
        punchIn: true,
        breakStart: true,
        breakEnd: true,
      },
    })
    return reply.send(punches)
  })

  // GET /api/time-punches/today?practiceId=...
  server.get<{ Querystring: { practiceId: string } }>('/time-punches/today', async (request, reply) => {
    const { practiceId } = request.query
    if (!practiceId) {
      return reply.status(400).send({ error: 'practiceId is required' })
    }
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const punches = await prisma.timePunch.findMany({
      where: {
        practiceId,
        punchIn: { gte: start, lte: end },
      },
      select: {
        id: true,
        userId: true,
        user: { select: { firstName: true, lastName: true } },
        locationId: true,
        location: { select: { name: true } },
        specialty: true,
        punchIn: true,
        punchOut: true,
        breakStart: true,
        breakEnd: true,
      },
      orderBy: { punchIn: 'asc' },
    })
    return reply.send(punches)
  })
}
