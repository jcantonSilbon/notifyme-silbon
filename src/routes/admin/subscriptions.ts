import type { FastifyInstance } from 'fastify'
import {
  getSubscriptions,
  deleteSubscription,
  forceRetrySubscription,
} from '../../services/subscriptionService.js'

export async function adminSubscriptionsRoute(fastify: FastifyInstance) {
  // List subscriptions with filters and pagination
  fastify.get('/admin/api/subscriptions', async (request, reply) => {
    const query = request.query as {
      page?: string
      limit?: string
      status?: string
      productId?: string
      variantId?: string
      search?: string
    }

    const page = Math.max(1, parseInt(query.page ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50', 10)))

    const result = await getSubscriptions({
      page,
      limit,
      status: query.status,
      productId: query.productId,
      variantId: query.variantId,
      search: query.search,
    })

    return reply.send(result)
  })

  // Force-retry a specific subscription
  fastify.post('/admin/api/subscriptions/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string }
    await forceRetrySubscription(id)
    return reply.send({ ok: true })
  })

  // Delete (soft-delete) a subscription
  fastify.delete('/admin/api/subscriptions/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await deleteSubscription(id)
    return reply.send({ ok: true })
  })
}
