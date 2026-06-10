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

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
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

    const activePunch = await prisma.timePunch.findFirst({
      where: { userId, punchOut: null },
    })
    if (activePunch) {
      return reply.status(409).send({ error: 'Already clocked in', punchId: activePunch.id })
    }

    const [punch, shift, user] = await Promise.all([
      prisma.timePunch.create({
        data: { practiceId, userId, locationId, specialty: specialty ?? null, punchIn: punchInDate },
      }),
      prisma.shift.findFirst({
        where: {
          practiceId, userId, locationId,
          date: { gte: new Date(punchInDate.toDateString()), lt: new Date(new Date(punchInDate.toDateString()).getTime() + 86400000) },
        },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { shiftStart: true } }),
    ])

    const effectiveStart = shift?.startTime ?? user?.shiftStart ?? null
    const tardy = effectiveStart ? isTardy(punchInDate, shift?.date ?? punchInDate, effectiveStart) : false

    if (tardy) {
      const occDate = new Date(punchInDate.toDateString())
      await prisma.employeeOccurrence.upsert({
        where: { userId_date_type: { userId, date: occDate, type: 'tardy' } },
        create: {
          practiceId,
          userId,
          date: occDate,
          type: 'tardy',
          notes: `Clocked in at ${punchInDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
        },
        update: {},
      })
    }

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

      const [punches, shifts, user] = await Promise.all([
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
        prisma.user.findUnique({ where: { id: userId }, select: { shiftStart: true } }),
      ])

      const result = punches.map((p) => {
        const s = shifts.find((sh) => {
          const shDate = new Date(sh.date)
          const pDate = new Date(p.punchIn)
          return shDate.toDateString() === pDate.toDateString()
        })
        const effectiveStart = s?.startTime ?? user?.shiftStart ?? null
        return { ...p, isTardy: effectiveStart ? isTardy(new Date(p.punchIn), s?.date ?? new Date(p.punchIn), effectiveStart) : false }
      })

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const punchDateStrings = new Set(result.map((p) => new Date(p.punchIn).toDateString()))
      const seenAbsent = new Set<string>()
      const absentDates: string[] = []

      for (const s of shifts) {
        const shiftDay = new Date(s.date)
        if (shiftDay < today && !punchDateStrings.has(shiftDay.toDateString())) {
          const iso = shiftDay.toISOString().split('T')[0]
          if (!seenAbsent.has(iso)) {
            seenAbsent.add(iso)
            absentDates.push(iso)
          }
        }
      }

      if (absentDates.length > 0) {
        await Promise.all(
          absentDates.map((iso) => {
            const dateObj = new Date(iso)
            return prisma.employeeOccurrence.upsert({
              where: { userId_date_type: { userId, date: dateObj, type: 'unexcused_absence' } },
              create: { practiceId, userId, date: dateObj, type: 'unexcused_absence' },
              update: {},
            })
          })
        )
      }

      return reply.send({ punches: result, absentDates })
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
          user: { select: { firstName: true, lastName: true, shiftStart: true } },
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
      const effectiveStart = s?.startTime ?? p.user.shiftStart ?? null
      return { ...p, isTardy: effectiveStart ? isTardy(new Date(p.punchIn), s?.date ?? new Date(p.punchIn), effectiveStart) : false }
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
          user: { select: { firstName: true, lastName: true, shiftStart: true } },
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
      const effectiveStart = s?.startTime ?? p.user.shiftStart ?? null
      return { ...p, isTardy: effectiveStart ? isTardy(new Date(p.punchIn), s?.date ?? new Date(p.punchIn), effectiveStart) : false }
    })
    return reply.send(result)
  })
}
