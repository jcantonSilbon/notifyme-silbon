import crypto from 'crypto'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config.js'

/**
 * Bearer token authentication for admin API routes.
 * Accepts token via Authorization header (API calls) or ?token= query param
 * (browser downloads like CSV export where headers cannot be set).
 * Uses timingSafeEqual to prevent timing oracle attacks.
 */
export async function adminAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization
  const queryToken = (request.query as Record<string, string>).token

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : queryToken ?? ''

  if (!token) {
    await reply.status(401).send({ error: 'Unauthorized' })
    return
  }

  const expected = config.ADMIN_TOKEN

  // Reject immediately if lengths differ (timingSafeEqual requires equal-length buffers)
  if (token.length !== expected.length) {
    await reply.status(401).send({ error: 'Unauthorized' })
    return
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(token, 'utf8'),
    Buffer.from(expected, 'utf8'),
  )

  if (!isValid) {
    await reply.status(401).send({ error: 'Unauthorized' })
    return
  }
}

/**
 * Bearer token authentication for cron endpoints.
 */
export async function cronAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await reply.status(401).send({ error: 'Unauthorized' })
    return
  }

  const token = authHeader.slice(7)
  const expected = config.CRON_SECRET

  if (token.length !== expected.length) {
    await reply.status(401).send({ error: 'Unauthorized' })
    return
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(token, 'utf8'),
    Buffer.from(expected, 'utf8'),
  )

  if (!isValid) {
    await reply.status(401).send({ error: 'Unauthorized' })
    return
  }
}
