import type { FastifyInstance } from 'fastify'
import { getNotificationCopy } from '../services/notificationCopyService.js'

export async function copyRoute(fastify: FastifyInstance) {
  fastify.get('/api/copy', async (request, reply) => {
    const query = request.query as { locale?: string }
    const copy = await getNotificationCopy(query.locale)
    return reply.send(copy)
  })
}
