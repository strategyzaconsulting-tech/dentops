import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  // Check if super admin already exists
  const existing = await prisma.$queryRaw`SELECT id, email, role FROM users WHERE email = 'jess.garcia.nyc@gmail.com'`
  if (existing.length > 0) {
    console.log('User already exists:', existing[0])
    process.exit(0)
  }

  // Check practice_id nullability at DB level
  const nullableCheck = await prisma.$queryRaw`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'practice_id'`
  console.log('practice_id nullable:', nullableCheck[0]?.is_nullable)

  // Insert super admin via raw SQL
  const result = await prisma.$executeRaw`
    INSERT INTO users (id, practice_id, first_name, last_name, email, role, status, password_hash)
    VALUES (gen_random_uuid(), NULL, 'Jess', 'Garcia', 'jess.garcia.nyc@gmail.com', 'super_admin', 'active', ${'$2b$12$E3IGSj68eG/QK4gVKLIdw.O9IISOTvOx0LZNUeimua6BgUhxSlkuG'})`
  console.log('Inserted rows:', result)
} catch (e) {
  console.error('Full error:', e.message)
  console.error('Code:', e.code)
  console.error('Meta:', JSON.stringify(e.meta))
} finally {
  await prisma.$disconnect()
}
