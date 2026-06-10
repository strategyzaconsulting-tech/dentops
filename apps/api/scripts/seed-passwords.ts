import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEFAULT_PASSWORD = 'Brisa2026!'

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12)
  const result = await prisma.user.updateMany({
    where: { passwordHash: null },
    data: { passwordHash: hash },
  })
  console.log(`Set password for ${result.count} users → ${DEFAULT_PASSWORD}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
