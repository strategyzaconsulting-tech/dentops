import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function shiftsRoutes(server: FastifyInstance) {
  // GET /api/shifts?practiceId=&weekStart=YYYY-MM-DD
  server.get<{ Querystring: { practiceId: string; weekStart: string } }>(
    '/shifts',
    async (request, reply) => {
      const { practiceId, weekStart } = request.query
      if (!practiceId) {
        return reply.status(400).send({ error: 'practiceId is required' })
      }

      const start = weekStart ? new Date(weekStart) : getMonday(new Date())
      const end = new Date(start)
      end.setDate(end.getDate() + 7)

      const shifts = await prisma.shift.findMany({
        where: {
          practiceId,
          date: { gte: start, lt: end },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
          location: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      })
      return reply.send(shifts)
    }
  )

  // POST /api/shifts
  server.post<{
    Body: {
      practiceId: string
      userId: string
      locationId: string
      date: string
      startTime: string
      endTime: string
      specialty?: string
      notes?: string
    }
  }>('/shifts', async (request, reply) => {
    const { practiceId, userId, locationId, date, startTime, endTime, specialty, notes } =
      request.body
    const shift = await prisma.shift.create({
      data: {
        practiceId,
        userId,
        locationId,
        date: new Date(date),
        startTime,
        endTime,
        specialty: specialty ?? null,
        notes: notes ?? null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true } },
      },
    })
    return reply.status(201).send(shift)
  })

  // PATCH /api/shifts/:id
  server.patch<{
    Params: { id: string }
    Body: {
      locationId?: string
      startTime?: string
      endTime?: string
      specialty?: string
      notes?: string
    }
  }>('/shifts/:id', async (request, reply) => {
    const { id } = request.params
    const { locationId, startTime, endTime, specialty, notes } = request.body

    const data: Record<string, unknown> = {}
    if (locationId !== undefined) data.locationId = locationId
    if (startTime !== undefined) data.startTime = startTime
    if (endTime !== undefined) data.endTime = endTime
    if (specialty !== undefined) data.specialty = specialty
    if (notes !== undefined) data.notes = notes

    const shift = await prisma.shift.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true } },
      },
    })
    return reply.send(shift)
  })

  // DELETE /api/shifts/:id
  server.delete<{ Params: { id: string } }>('/shifts/:id', async (request, reply) => {
    const { id } = request.params
    await prisma.shift.delete({ where: { id } })
    return reply.status(204).send()
  })
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}
