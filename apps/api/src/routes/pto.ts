import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

const TYPE_LABELS: Record<string, string> = {
  pto: 'PTO request',
  unpaid: 'Unpaid time-off request',
  schedule_adjustment: 'Schedule adjustment',
  late_arrival: 'Late arrival request',
  early_departure: 'Early departure request',
  long_lunch: 'Long lunch request',
}

async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ to: token, title, body, sound: 'default', data }),
    })
  } catch {
    // non-blocking — notification failure never breaks the API response
  }
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

      const PTO_TYPES = ['pto', 'vacation', 'sick', 'personal']

      const [practice, staffUser, requests] = await Promise.all([
        prisma.practice.findUnique({ where: { id: practiceId }, select: { defaultPtoDays: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { ptoDaysPerYear: true } }),
        prisma.ptoRequest.findMany({
          where: {
            practiceId,
            userId,
            status: { in: ['approved', 'pending'] },
            startDate: { gte: yearStart },
            endDate: { lte: yearEnd },
          },
        }),
      ])

      const total = staffUser?.ptoDaysPerYear ?? practice?.defaultPtoDays ?? 15

      let usedDays = 0
      let pendingDays = 0
      for (const req of requests) {
        if (!PTO_TYPES.includes(req.type)) continue
        const days = daysBetween(req.startDate, req.endDate)
        if (req.status === 'approved') usedDays += days
        else pendingDays += days
      }

      const available = Math.max(0, total - usedDays - pendingDays)

      return reply.send({
        pto: { total, used: usedDays, pending: pendingDays, available, remaining: Math.max(0, total - usedDays) },
      })
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
    Body: { status?: string; startDate?: string; endDate?: string; type?: string; notes?: string | null }
  }>('/pto/requests/:id', async (request, reply) => {
    const { id } = request.params
    const { status, startDate, endDate, type, notes } = request.body

    if (status !== undefined && !['approved', 'denied', 'pending'].includes(status)) {
      return reply.status(400).send({ error: 'Invalid status' })
    }

    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (startDate !== undefined) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = new Date(endDate)
    if (type !== undefined) data.type = type
    if (notes !== undefined) data.notes = notes ?? null

    const req = await prisma.ptoRequest.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, pushToken: true } },
      },
    })

    if (req.user.pushToken && status && status !== 'pending') {
      const typeLabel = TYPE_LABELS[req.type] ?? 'Request'
      const approved = status === 'approved'
      await sendPushNotification(
        req.user.pushToken,
        approved ? 'Request Approved ✓' : 'Request Denied',
        `Your ${typeLabel} has been ${approved ? 'approved' : 'denied'}.`,
        { requestId: id, status, type: req.type }
      )
    }

    return reply.send(req)
  })

  // DELETE /api/pto/requests/:id
  server.delete<{ Params: { id: string } }>(
    '/pto/requests/:id',
    async (request, reply) => {
      const { id } = request.params
      // Verify the request belongs to this practice before deleting
      const existing = await prisma.ptoRequest.findUnique({ where: { id }, select: { practiceId: true } })
      if (!existing || existing.practiceId !== request.user.practiceId) {
        return reply.status(404).send({ error: 'Not found' })
      }
      await prisma.ptoRequest.delete({ where: { id } })
      return reply.status(204).send()
    }
  )

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

  // GET /api/pto/blackout-dates?practiceId=&type=
  server.get<{ Querystring: { practiceId: string; type?: string } }>(
    '/pto/blackout-dates',
    async (request, reply) => {
      const { practiceId, type } = request.query
      if (!practiceId) {
        return reply.status(400).send({ error: 'practiceId is required' })
      }
      const dates = await prisma.blackoutDate.findMany({
        where: { practiceId, ...(type ? { type } : {}) },
        orderBy: { date: 'asc' },
      })
      return reply.send(dates)
    }
  )

  // POST /api/pto/blackout-dates
  server.post<{
    Body: { practiceId: string; date: string; reason?: string; type?: string; name?: string }
  }>('/pto/blackout-dates', async (request, reply) => {
    const { practiceId, date, reason, type, name } = request.body
    const d = await prisma.blackoutDate.create({
      data: {
        practiceId,
        date: new Date(date),
        reason: reason ?? null,
        type: type ?? 'blackout',
        name: name ?? null,
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

  // ─── PTO Policy ──────────────────────────────────────────────────────────────

  // GET /api/pto/policy — returns practice PTO policy
  server.get('/pto/policy', async (request, reply) => {
    const practiceId = request.user.practiceId
    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
      select: { defaultPtoDays: true, ptoCustomAllowed: true },
    })
    if (!practice) return reply.status(404).send({ error: 'Practice not found' })
    return reply.send(practice)
  })

  // PATCH /api/pto/policy
  server.patch<{ Body: { defaultPtoDays?: number; ptoCustomAllowed?: boolean } }>(
    '/pto/policy',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const { defaultPtoDays, ptoCustomAllowed } = request.body
      const data: Record<string, unknown> = {}
      if (defaultPtoDays !== undefined) {
        if (defaultPtoDays < 0 || defaultPtoDays > 365) {
          return reply.status(400).send({ error: 'defaultPtoDays must be 0–365' })
        }
        data.defaultPtoDays = defaultPtoDays
      }
      if (ptoCustomAllowed !== undefined) data.ptoCustomAllowed = ptoCustomAllowed
      const practice = await prisma.practice.update({ where: { id: practiceId }, data })
      return reply.send({ defaultPtoDays: practice.defaultPtoDays, ptoCustomAllowed: practice.ptoCustomAllowed })
    }
  )

  // ─── Staff PTO Summary ────────────────────────────────────────────────────────

  // GET /api/pto/staff-summary?year= — PTO breakdown for every active staff member
  server.get<{ Querystring: { year?: string } }>(
    '/pto/staff-summary',
    async (request, reply) => {
      const practiceId = request.user.practiceId
      const year = parseInt(request.query.year ?? String(new Date().getFullYear()), 10)

      const practice = await prisma.practice.findUnique({
        where: { id: practiceId },
        select: { defaultPtoDays: true },
      })
      const practiceDefault = practice?.defaultPtoDays ?? 15

      const yearStart = new Date(year, 0, 1)
      const yearEnd = new Date(year, 11, 31, 23, 59, 59)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const staff = await prisma.user.findMany({
        where: { practiceId, status: { in: ['active', 'on_leave'] } },
        select: {
          id: true,
          ptoDaysPerYear: true,
          hireDate: true,
          probationCompletedAt: true,
          probationEndDate: true,
          probationStatus: true,
        },
      })

      // Exclude non-PTO request types from the tracker
      const EXCLUDED_TYPES = new Set(['schedule_adjustment', 'late_arrival', 'early_departure', 'long_lunch'])

      const requests = await prisma.ptoRequest.findMany({
        where: {
          practiceId,
          status: { in: ['approved', 'pending'] },
          type: { notIn: [...EXCLUDED_TYPES] },
          startDate: { lte: yearEnd },
          endDate: { gte: yearStart },
        },
        select: { id: true, userId: true, startDate: true, endDate: true, type: true, status: true, notes: true },
        orderBy: { startDate: 'asc' },
      })

      const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
      const daysInYear = isLeapYear(year) ? 366 : 365

      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

      function calcAllocation(user: typeof staff[0]): { allocation: number; isProrated: boolean; proratedFrom: Date | null } {
        const annualDays = user.ptoDaysPerYear ?? practiceDefault
        const probationDone = user.probationStatus === 'completed' ? user.probationCompletedAt : null
        const prorateCandidate = probationDone ?? user.hireDate

        if (prorateCandidate && prorateCandidate.getFullYear() === year) {
          const dayOfYear = Math.floor(
            (prorateCandidate.getTime() - new Date(year, 0, 1).getTime()) / 86400000
          )
          const remainingDays = daysInYear - dayOfYear
          return {
            allocation: Math.ceil((remainingDays / daysInYear) * annualDays),
            isProrated: true,
            proratedFrom: prorateCandidate,
          }
        }

        return { allocation: annualDays, isProrated: false, proratedFrom: null }
      }

      type DayItem = { date: string; dayOfWeek: string; type: string; status: string; bucket: 'used' | 'pending'; requestId: string; requestStart: string; requestEnd: string; notes: string | null }

      const summary = staff.map((u) => {
        const { allocation, isProrated, proratedFrom } = calcAllocation(u)
        const userRequests = requests.filter((r) => r.userId === u.id)

        // Expand into individual days, dedup by date (first request wins for a given date)
        const seenDates = new Set<string>()
        const items: DayItem[] = []

        for (const r of userRequests) {
          const start = new Date(Math.max(new Date(r.startDate).getTime(), yearStart.getTime()))
          const end = new Date(Math.min(new Date(r.endDate).getTime(), yearEnd.getTime()))
          const cur = new Date(start)
          cur.setHours(0, 0, 0, 0)

          while (cur <= end) {
            const dateStr = cur.toISOString().split('T')[0]
            if (!seenDates.has(dateStr)) {
              seenDates.add(dateStr)
              const isPast = cur < today
              const bucket: 'used' | 'pending' = (r.status === 'approved' && isPast) ? 'used' : 'pending'
              items.push({
                date: dateStr,
                dayOfWeek: DAY_NAMES[cur.getDay()],
                type: r.type,
                status: r.status,
                bucket,
                requestId: r.id,
                requestStart: new Date(r.startDate).toISOString().split('T')[0],
                requestEnd: new Date(r.endDate).toISOString().split('T')[0],
                notes: r.notes,
              })
            }
            cur.setDate(cur.getDate() + 1)
          }
        }

        // Sort chronologically
        items.sort((a, b) => a.date.localeCompare(b.date))

        const used = items.filter(i => i.bucket === 'used').length
        const requested = items.filter(i => i.bucket === 'pending').length
        const remaining = Math.max(0, allocation - used - requested)
        return { userId: u.id, allocation, used, requested, remaining, isProrated, proratedFrom, items }
      })

      return reply.send(summary)
    }
  )
}
