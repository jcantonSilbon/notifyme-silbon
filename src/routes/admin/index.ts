import type { FastifyInstance } from 'fastify'
import { adminAuth } from '../../middleware/adminAuth.js'
import { adminSubscriptionsRoute } from './subscriptions.js'
import { adminStatsRoute } from './stats.js'
import { adminExportRoute } from './export.js'

export async function adminRoutes(fastify: FastifyInstance) {
  // Apply adminAuth to all /admin/api/* routes
  fastify.addHook('preHandler', adminAuth)

  await fastify.register(adminSubscriptionsRoute)
  await fastify.register(adminStatsRoute)
  await fastify.register(adminExportRoute)
}
