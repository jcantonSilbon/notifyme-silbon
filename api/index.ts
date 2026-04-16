/**
 * Vercel Serverless Function entry point.
 *
 * Vercel does not run a persistent TCP server — it invokes this exported handler
 * for every incoming request. We build the Fastify app once (module-level singleton)
 * and reuse it across warm invocations, then bridge Node's IncomingMessage/ServerResponse
 * to Fastify via `fastify.server.emit('request', ...)`.
 */
import 'dotenv/config'
import type { IncomingMessage, ServerResponse } from 'http'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'

import { config } from '../src/config.js'
import { subscribeRoute } from '../src/routes/subscribe.js'
import { webhookRoute } from '../src/routes/webhook.js'
import { cronRoute } from '../src/routes/cron.js'
import { adminRoutes } from '../src/routes/admin/index.js'
import { logger } from '../src/utils/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Build Fastify app ────────────────────────────────────────────────────────
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

// Admin UI static files — built to dist/admin by `npm run build:admin`
const adminDistPath = path.join(__dirname, '..', 'dist', 'admin')
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

// Ready the app (binds plugins, routes, etc.) without opening a TCP port
await fastify.ready()

logger.info('Fastify app ready (serverless mode)', { env: config.NODE_ENV })

// ── Vercel handler export ────────────────────────────────────────────────────
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  fastify.server.emit('request', req, res)
}
