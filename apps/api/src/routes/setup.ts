import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'

interface Doctor {
  firstName: string
  lastName: string
  email: string
  specialty: string
}

interface StaffMember {
  firstName: string
  lastName: string
  email: string
  role: string
}

interface LocationInput {
  name: string
  address: string
  city: string
  state: string
  zip: string
}

interface PracticeInput {
  name: string
  type: string
  ownerName: string
  email: string
  phone: string
  tagline: string
}

interface SetupBody {
  practice: PracticeInput
  brandColor: string
  specialties: string[]
  doctors: Doctor[]
  staff: StaffMember[]
  locations: LocationInput[]
  adminPassword?: string
  existingUserId?: string
}

export default async function setupRoutes(server: FastifyInstance) {
  server.post<{ Body: SetupBody }>('/setup', async (request, reply) => {
    const { practice, brandColor, doctors, staff, locations, adminPassword, existingUserId } = request.body

    if (!existingUserId && (!adminPassword || adminPassword.length < 8)) {
      return reply.status(400).send({ error: 'adminPassword must be at least 8 characters' })
    }

    // 1. Create the practice
    const createdPractice = await prisma.practice.create({
      data: { name: practice.name, type: practice.type, brandColor },
    })

    const practiceId = createdPractice.id

    // 2. Create locations
    if (locations && locations.length > 0) {
      await prisma.location.createMany({
        data: locations.map((loc) => ({
          practiceId, name: loc.name, address: loc.address,
          city: loc.city, state: loc.state, zip: loc.zip,
        })),
      })
    }

    // 3. Create or link admin/owner user
    let owner
    if (existingUserId) {
      owner = await prisma.user.update({
        where: { id: existingUserId },
        data: { practiceId, role: 'manager', status: 'active' },
      })
    } else {
      const passwordHash = await bcrypt.hash(adminPassword!, 12)
      const ownerEmail = practice.email.toLowerCase().trim()
      const cleanName = practice.ownerName.trim().replace(/^(Dr|Mr|Mrs|Ms|Miss|Prof|Rev|Sir)\.?\s+/i, '')
      const nameParts = cleanName.split(' ')
      const ownerFirst = nameParts[0]
      const ownerLast = nameParts.slice(1).join(' ') || ownerFirst
      owner = await prisma.user.create({
        data: {
          practiceId, firstName: ownerFirst, lastName: ownerLast,
          email: ownerEmail, role: 'manager', status: 'active', passwordHash,
        },
      })
    }

    // 4. Create doctors
    if (doctors && doctors.length > 0) {
      await prisma.user.createMany({
        data: doctors.map((doc) => ({
          practiceId, firstName: doc.firstName, lastName: doc.lastName,
          email: doc.email, role: 'doctor', status: 'invited',
        })),
        skipDuplicates: true,
      })
    }

    // 5. Create staff
    if (staff && staff.length > 0) {
      await prisma.user.createMany({
        data: staff.map((member) => ({
          practiceId, firstName: member.firstName, lastName: member.lastName,
          email: member.email, role: 'staff', status: 'invited',
        })),
        skipDuplicates: true,
      })
    }

    // Return JWT so the admin is immediately logged in after setup
    const token = server.jwt.sign(
      { userId: owner.id, practiceId, role: owner.role, email: owner.email },
      { expiresIn: '8h' }
    )

    return reply.status(201).send({ practiceId, token, userId: owner.id })
  })
}
