import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JwtPayload {
  userId: string
  practiceId: string | null
  role: string
  email: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload
  }
}

const PUBLIC_ROUTES = new Set([
  'POST /api/auth/login',
  'POST /api/setup',
  'GET /api/health',
  'POST /api/admin/super-admin',
])

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const routeKey = `${request.method} ${request.url.split('?')[0]}`
  if (PUBLIC_ROUTES.has(routeKey)) return

  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  // Super admin can impersonate any practice by passing X-Practice-Id header
  if (request.user.role === 'super_admin') {
    const override = request.headers['x-practice-id']
    if (typeof override === 'string' && override) {
      request.user.practiceId = override
    }
    return
  }

  // IDOR guard: practiceId in body/query must match the token
  const body = request.body as Record<string, unknown> | null
  const query = request.query as Record<string, unknown>
  const incoming = (body?.practiceId ?? query?.practiceId) as string | undefined
  if (incoming && incoming !== request.user.practiceId) {
    return reply.status(403).send({ error: 'Forbidden' })
  }
}
