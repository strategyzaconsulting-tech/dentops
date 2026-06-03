import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

const TARDY_GRACE_MS = 10 * 60 * 1000

function parseShiftStart(shiftDate: Date, startTime: string): Date {
  const d = new Date(shiftDate)
  d.setSeconds(0, 0)
  const ampm = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = parseInt(ampm[2], 10)
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12
    d.setHours(h, m)
    return d
  }
  const hhmm = startTime.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    d.setHours(parseInt(hhmm[1], 10), parseInt(hhmm[2], 10))
    return d
  }
  return d
}

function isTardy(punchIn: Date, shiftDate: Date, startTime: string): boolean {
  const scheduled = parseShiftStart(shiftDate, startTime)
  return punchIn.getTime() > scheduled.getTime() + TARDY_GRACE_MS
}

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
    const punchInDate = new Date(punchIn)

    const [punch, shift] = await Promise.all([
      prisma.timePunch.create({
        data: { practiceId, userId, locationId, specialty: specialty ?? null, punchIn: punchInDate },
      }),
      prisma.shift.findFirst({
        where: {
          practiceId, userId, locationId,
          date: { gte: new Date(punchInDate.toDateString()), lt: new Date(new Date(punchInDate.toDateString()).getTime() + 86400000) },
        },
      }),
    ])

    const tardy = shift ? isTardy(punchInDate, shift.date, shift.startTime) : false
    return reply.status(201).send({ ...punch, isTardy: tardy })
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

  // GET /api/time-punches/mine?practiceId=&userId=&weekStart=YYYY-MM-DD
  server.get<{ Querystring: { practiceId: string; userId: string; weekStart?: string } }>(
    '/time-punches/mine',
    async (request, reply) => {
      const { practiceId, userId, weekStart } = request.query
      if (!practiceId || !userId) {
        return reply.status(400).send({ error: 'practiceId and userId are required' })
      }
      const start = weekStart ? new Date(weekStart) : getMonday(new Date())
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      end.setHours(23, 59, 59, 999)

      const [punches, shifts] = await Promise.all([
        prisma.timePunch.findMany({
          where: { practiceId, userId, punchIn: { gte: start, lte: end } },
          select: {
            id: true, punchIn: true, punchOut: true,
            location: { select: { name: true } },
            specialty: true, breakStart: true, breakEnd: true,
          },
          orderBy: { punchIn: 'asc' },
        }),
        prisma.shift.findMany({ where: { practiceId, userId, date: { gte: start, lt: end } } }),
      ])

      const shiftMap = new Map(shifts.map((s) => [`${s.userId}:${s.locationId}`, s]))
      const result = punches.map((p) => {
        const s = shifts.find((sh) => {
          const shDate = new Date(sh.date)
          const pDate = new Date(p.punchIn)
          return shDate.toDateString() === pDate.toDateString()
        })
        return { ...p, isTardy: s ? isTardy(new Date(p.punchIn), s.date, s.startTime) : false }
      })
      void shiftMap
      return reply.send(result)
    }
  )

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

    const [punches, shifts] = await Promise.all([
      prisma.timePunch.findMany({
        where: { practiceId, punchOut: null, punchIn: { gte: start, lte: end } },
        select: {
          id: true, userId: true,
          user: { select: { firstName: true, lastName: true } },
          locationId: true,
          location: { select: { name: true } },
          specialty: true, punchIn: true, breakStart: true, breakEnd: true,
        },
      }),
      prisma.shift.findMany({ where: { practiceId, date: { gte: start, lte: end } } }),
    ])

    const shiftMap = new Map(shifts.map((s) => [`${s.userId}:${s.locationId}`, s]))
    const result = punches.map((p) => {
      const s = shiftMap.get(`${p.userId}:${p.locationId}`)
      return { ...p, isTardy: s ? isTardy(new Date(p.punchIn), s.date, s.startTime) : false }
    })
    return reply.send(result)
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

    const [punches, shifts] = await Promise.all([
      prisma.timePunch.findMany({
        where: { practiceId, punchIn: { gte: start, lte: end } },
        select: {
          id: true, userId: true,
          user: { select: { firstName: true, lastName: true } },
          locationId: true,
          location: { select: { name: true } },
          specialty: true, punchIn: true, punchOut: true, breakStart: true, breakEnd: true,
        },
        orderBy: { punchIn: 'asc' },
      }),
      prisma.shift.findMany({ where: { practiceId, date: { gte: start, lte: end } } }),
    ])

    const shiftMap = new Map(shifts.map((s) => [`${s.userId}:${s.locationId}`, s]))
    const result = punches.map((p) => {
      const s = shiftMap.get(`${p.userId}:${p.locationId}`)
      return { ...p, isTardy: s ? isTardy(new Date(p.punchIn), s.date, s.startTime) : false }
    })
    return reply.send(result)
  })
}
