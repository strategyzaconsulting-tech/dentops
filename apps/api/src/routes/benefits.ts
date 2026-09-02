import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

const DEFAULT_BENEFITS = [
  { name: 'Health Insurance', isDefault: true, sortOrder: 0 },
  { name: 'Dental Plan', isDefault: true, sortOrder: 1 },
  { name: 'Vision Plan', isDefault: true, sortOrder: 2 },
  { name: 'Retirement Plan (401k)', isDefault: true, sortOrder: 3 },
  { name: 'PTO', isDefault: true, sortOrder: 4 },
  { name: 'Commuter Benefits', isDefault: true, sortOrder: 5 },
  { name: 'Life Insurance', isDefault: true, sortOrder: 6 },
]

export default async function benefitRoutes(server: FastifyInstance) {
  // GET /api/benefits?practiceId= — list, auto-seed defaults if first time
  server.get<{ Querystring: { practiceId: string } }>(
    '/benefits',
    async (request, reply) => {
      const { practiceId } = request.query
      if (!practiceId) return reply.status(400).send({ error: 'practiceId is required' })

      let benefits = await prisma.practiceBenefit.findMany({
        where: { practiceId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })

      if (benefits.length === 0) {
        await prisma.practiceBenefit.createMany({
          data: DEFAULT_BENEFITS.map((b) => ({ ...b, practiceId })),
        })
        benefits = await prisma.practiceBenefit.findMany({
          where: { practiceId },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
      }

      return reply.send(benefits)
    }
  )

  // POST /api/benefits — add custom benefit
  server.post<{ Body: { practiceId: string; name: string } }>(
    '/benefits',
    async (request, reply) => {
      const { practiceId, name } = request.body
      if (!practiceId || !name) return reply.status(400).send({ error: 'practiceId and name are required' })

      const existing = await prisma.practiceBenefit.findMany({ where: { practiceId }, orderBy: { sortOrder: 'desc' } })
      const nextOrder = existing.length > 0 ? existing[0].sortOrder + 1 : 10

      const benefit = await prisma.practiceBenefit.create({
        data: { practiceId, name: name.trim(), isDefault: false, sortOrder: nextOrder },
      })
      return reply.status(201).send(benefit)
    }
  )

  // PATCH /api/benefits/:id — update plan contact details
  server.patch<{
    Params: { id: string }
    Body: {
      name?: string
      providerName?: string | null
      phone?: string | null
      email?: string | null
      website?: string | null
      notes?: string | null
    }
  }>('/benefits/:id', async (request, reply) => {
    const { id } = request.params
    const { name, providerName, phone, email, website, notes } = request.body
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (providerName !== undefined) data.providerName = providerName || null
    if (phone !== undefined) data.phone = phone || null
    if (email !== undefined) data.email = email || null
    if (website !== undefined) data.website = website || null
    if (notes !== undefined) data.notes = notes || null
    const benefit = await prisma.practiceBenefit.update({ where: { id }, data })
    return reply.send(benefit)
  })

  // DELETE /api/benefits/:id — remove custom benefit (cascades user_benefits)
  server.delete<{ Params: { id: string } }>(
    '/benefits/:id',
    async (request, reply) => {
      const benefit = await prisma.practiceBenefit.findUnique({ where: { id: request.params.id } })
      if (benefit?.isDefault) return reply.status(400).send({ error: 'Default benefits cannot be deleted' })
      await prisma.practiceBenefit.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    }
  )

  // GET /api/benefits/user?practiceId=&userId= — merged list with enabled status
  server.get<{ Querystring: { practiceId: string; userId: string } }>(
    '/benefits/user',
    async (request, reply) => {
      const { practiceId, userId } = request.query
      if (!practiceId || !userId) return reply.status(400).send({ error: 'practiceId and userId are required' })

      const [benefits, userBenefits] = await Promise.all([
        prisma.practiceBenefit.findMany({
          where: { practiceId },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
        prisma.userBenefit.findMany({ where: { practiceId, userId } }),
      ])

      const enabledMap = new Map(userBenefits.map((ub) => [ub.benefitId, ub.enabled]))
      const result = benefits.map((b) => ({
        ...b,
        enabled: enabledMap.get(b.id) ?? false,
      }))

      return reply.send(result)
    }
  )

  // PATCH /api/benefits/user — toggle a benefit for a user
  server.patch<{ Body: { practiceId: string; userId: string; benefitId: string; enabled: boolean } }>(
    '/benefits/user',
    async (request, reply) => {
      const { practiceId, userId, benefitId, enabled } = request.body
      const record = await prisma.userBenefit.upsert({
        where: { userId_benefitId: { userId, benefitId } },
        create: { practiceId, userId, benefitId, enabled },
        update: { enabled },
      })
      return reply.send(record)
    }
  )
}
