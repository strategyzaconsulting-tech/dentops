import { prisma } from '../src/lib/prisma.js'

const active = await prisma.timePunch.findMany({
  where: { punchOut: null },
  orderBy: { punchIn: 'asc' },
  select: { id: true, userId: true, punchIn: true, user: { select: { firstName: true, lastName: true } } },
})

// Group by userId
const byUser = new Map<string, typeof active>()
for (const p of active) {
  const list = byUser.get(p.userId) ?? []
  list.push(p)
  byUser.set(p.userId, list)
}

let deleted = 0
for (const [, punches] of byUser) {
  if (punches.length <= 1) continue
  const keep = punches[0] // earliest
  const remove = punches.slice(1)
  const { firstName, lastName } = keep.user
  console.log(`${firstName} ${lastName}: keeping ${keep.id} (${keep.punchIn.toISOString()}), deleting ${remove.length} duplicate(s)`)
  await prisma.timePunch.deleteMany({ where: { id: { in: remove.map((p) => p.id) } } })
  deleted += remove.length
}

if (deleted === 0) console.log('No duplicates found.')
else console.log(`Done — removed ${deleted} duplicate punch(es).`)

await prisma.$disconnect()
