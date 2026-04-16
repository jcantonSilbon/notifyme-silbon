import type { FastifyInstance } from 'fastify'
import { cronAuth } from '../middleware/adminAuth.js'
import { retryFailed } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'

export async function cronRoute(fastify: FastifyInstance) {
  /**
   * GET /api/cron/retry-failed
   * Called by Vercel cron every 15 minutes.
   * Retries PENDING subscriptions that previously failed to send.
   */
  fastify.get(
    '/api/cron/retry-failed',
    { preHandler: cronAuth },
    async (_request, reply) => {
      logger.info('Cron job started: retry-failed')

      const result = await retryFailed()

      logger.info('Cron job completed: retry-failed', result)

      return reply.status(200).send(result)
    },
  )
}
