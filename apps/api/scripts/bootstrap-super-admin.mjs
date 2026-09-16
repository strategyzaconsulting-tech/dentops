/**
 * One-off script: create the platform super admin user.
 * Run via: railway run node apps/api/scripts/bootstrap-super-admin.mjs
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'jess.garcia.nyc@gmail.com'
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'DentOps2026!'
const FIRST = process.env.SUPER_ADMIN_FIRST ?? 'Jess'
const LAST = process.env.SUPER_ADMIN_LAST ?? 'Garcia'

const prisma = new PrismaClient()

const existing = await prisma.user.findFirst({ where: { role: 'super_admin' } })
if (existing) {
  console.log('Super admin already exists:', existing.email)
  await prisma.$disconnect()
  process.exit(0)
}

const passwordHash = await bcrypt.hash(PASSWORD, 12)
const user = await prisma.user.create({
  data: {
    practiceId: null,
    firstName: FIRST,
    lastName: LAST,
    email: EMAIL.toLowerCase().trim(),
    role: 'super_admin',
    status: 'active',
    passwordHash,
  },
})

console.log('Created super admin:', user.email, '(id:', user.id + ')')
await prisma.$disconnect()
