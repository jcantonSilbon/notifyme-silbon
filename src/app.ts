/**
 * Builds and returns the Fastify app ready for use.
 * Shared between:
 *   - src/index.ts      (local dev — calls fastify.listen())
 *   - api/index.ts      (Vercel serverless — calls fastify.server.emit('request', ...))
 */
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'

import { config } from './config.js'
import { subscribeRoute } from './routes/subscribe.js'
import { webhookRoute } from './routes/webhook.js'
import { cronRoute } from './routes/cron.js'
import { adminRoutes } from './routes/admin/index.js'
import { logger } from './utils/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({
  logger: false,
  trustProxy: true,
})

fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body, done) => {
    ;(req as typeof req & { rawBody: Buffer }).rawBody = body as Buffer
    try {
      done(null, JSON.parse((body as Buffer).toString('utf8')))
    } catch (err) {
      done(err as Error, undefined)
    }
  },
)

await fastify.register(cors, {
  origin: [
    'https://silbon.com',
    'https://silbon.myshopify.com',
    ...(config.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:5173']
      : []),
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
})

await fastify.register(rateLimit, {
  global: false,
  max: 5,
  timeWindow: '10 minutes',
  keyGenerator: (request) =>
    (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? request.ip,
  errorResponseBuilder: (_request, context) => ({
    ok: false,
    error: 'Demasiadas solicitudes. Por favor, inténtalo de nuevo más tarde.',
    retryAfter: context.after,
  }),
})

await fastify.register(subscribeRoute)
await fastify.register(webhookRoute)
await fastify.register(cronRoute)
await fastify.register(adminRoutes)

// Admin UI (static SPA) — built to dist/admin by `npm run build:admin`
// __dirname here is dist/ at runtime, so dist/admin is one level down
const adminDistPath = path.join(__dirname, 'admin')
try {
  await fastify.register(fastifyStatic, {
    root: adminDistPath,
    prefix: '/admin',
    decorateReply: false,
    index: 'index.html',
  })
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/admin')) {
      return reply.sendFile('index.html', adminDistPath)
    }
    return reply.status(404).send({ error: 'Not found' })
  })
} catch {
  logger.info('Admin UI not found at dist/admin — skipping static file serving')
}

fastify.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }))

await fastify.ready()

export { fastify }
