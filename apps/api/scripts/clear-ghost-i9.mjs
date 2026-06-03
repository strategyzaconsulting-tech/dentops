import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const record = await prisma.onboardingChecklist.findUnique({
  where: { practiceId_userId: {
    practiceId: 'd3f9ec81-7070-4be1-aa6d-fa45b72f2357',
    userId: '165234da-d643-41e8-8ec8-6e400d18a1d2',
  }},
})

console.log('i9CompletedAt:', record?.i9CompletedAt)
console.log('i9Data:', JSON.stringify(record?.i9Data))

const i9Data = record?.i9Data
const hasRealData = i9Data && typeof i9Data === 'object' && Object.keys(i9Data).length > 0 && i9Data.signatureName

if (record?.i9CompletedAt && !hasRealData) {
  await prisma.onboardingChecklist.update({
    where: { id: record.id },
    data: { i9CompletedAt: null, i9Data: null },
  })
  console.log('✓ Ghost I-9 cleared.')
} else {
  console.log('No action needed.')
}

await prisma.$disconnect()
