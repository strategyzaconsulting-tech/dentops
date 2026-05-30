import type { FastifyInstance } from 'fastify'
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
}

export default async function setupRoutes(server: FastifyInstance) {
  server.post<{ Body: SetupBody }>('/setup', async (request, reply) => {
    const { practice, brandColor, doctors, staff, locations } = request.body

    // 1. Create the practice
    const createdPractice = await prisma.practice.create({
      data: {
        name: practice.name,
        type: practice.type,
        brandColor,
      },
    })

    const practiceId = createdPractice.id

    // 2. Create locations
    if (locations && locations.length > 0) {
      await prisma.location.createMany({
        data: locations.map((loc) => ({
          practiceId,
          name: loc.name,
          address: loc.address,
          city: loc.city,
          state: loc.state,
          zip: loc.zip,
        })),
      })
    }

    // 3. Create doctors as users with role 'doctor'
    if (doctors && doctors.length > 0) {
      await prisma.user.createMany({
        data: doctors.map((doc) => ({
          practiceId,
          firstName: doc.firstName,
          lastName: doc.lastName,
          email: doc.email,
          role: 'doctor',
          status: 'invited',
        })),
        skipDuplicates: true,
      })
    }

    // 4. Create staff members as users with role 'staff'
    if (staff && staff.length > 0) {
      await prisma.user.createMany({
        data: staff.map((member) => ({
          practiceId,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          role: 'staff',
          status: 'invited',
        })),
        skipDuplicates: true,
      })
    }

    return reply.status(201).send({ practiceId })
  })
}
