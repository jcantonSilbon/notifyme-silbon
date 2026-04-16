import type { FastifyInstance } from 'fastify'
import { createSubscription } from '../services/subscriptionService.js'

export async function subscribeRoute(fastify: FastifyInstance) {
  fastify.post('/api/subscribe', async (request, reply) => {
    const result = await createSubscription(request.body)

    switch (result.status) {
      case 'created':
        return reply.status(201).send({
          ok: true,
          message: 'Te avisaremos cuando esté disponible',
        })

      case 'duplicate':
        return reply.status(200).send({
          ok: true,
          message: 'Ya estás en la lista de espera',
        })

      case 'invalid':
        return reply.status(400).send({
          ok: false,
          error: result.error,
        })
    }
  })
}
