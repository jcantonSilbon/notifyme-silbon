import type { FastifyInstance } from 'fastify'
import { getStats } from '../../services/subscriptionService.js'

export async function adminStatsRoute(fastify: FastifyInstance) {
  fastify.get('/admin/api/stats', async (_request, reply) => {
    const stats = await getStats()
    return reply.send(stats)
  })
}
