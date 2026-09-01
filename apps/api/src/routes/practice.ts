import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default async function practiceRoutes(server: FastifyInstance) {
  server.get<{ Params: { id: string } }>('/practice/:id', async (request, reply) => {
    const { id } = request.params
    const practice = await prisma.practice.findUnique({ where: { id } })
    if (!practice) return reply.status(404).send({ error: 'Practice not found' })
    return reply.send(practice)
  })

  server.patch<{
    Params: { id: string }
    Body: {
      name?: string
      type?: string
      logoUrl?: string
      brandColor?: string
      phone?: string
      email?: string
      address?: string
      city?: string
      state?: string
      zip?: string
      website?: string
      requireSpecialty?: boolean
      defaultPtoDays?: number
      ptoCustomAllowed?: boolean
      payrollPeriod?: string | null
      payrollStartDay?: number | null
      payrollNextDate?: string | null
    }
  }>(
    '/practice/:id',
    async (request, reply) => {
      const { id } = request.params
      const {
        name, type, logoUrl, brandColor,
        phone, email, address, city, state, zip, website,
        requireSpecialty, defaultPtoDays, ptoCustomAllowed,
        payrollPeriod, payrollStartDay, payrollNextDate,
      } = request.body
      const practice = await prisma.practice.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(logoUrl !== undefined && { logoUrl }),
          ...(brandColor !== undefined && { brandColor }),
          ...(phone !== undefined && { phone }),
          ...(email !== undefined && { email }),
          ...(address !== undefined && { address }),
          ...(city !== undefined && { city }),
          ...(state !== undefined && { state }),
          ...(zip !== undefined && { zip }),
          ...(website !== undefined && { website }),
          ...(requireSpecialty !== undefined && { requireSpecialty }),
          ...(defaultPtoDays !== undefined && { defaultPtoDays }),
          ...(ptoCustomAllowed !== undefined && { ptoCustomAllowed }),
          ...(payrollPeriod !== undefined && { payrollPeriod: payrollPeriod ?? null }),
          ...(payrollStartDay !== undefined && { payrollStartDay: payrollStartDay ?? null }),
          ...(payrollNextDate !== undefined && { payrollNextDate: payrollNextDate ? new Date(payrollNextDate) : null }),
        },
      })
      return reply.send(practice)
    }
  )
}
