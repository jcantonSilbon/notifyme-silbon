import 'dotenv/config'
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
  logger: false, // Using our own structured logger
  trustProxy: true, // Required for correct IP detection behind Vercel's proxy
})

// ─── Raw body capture for Shopify webhook HMAC verification ────────────────
// Must be registered BEFORE any other content type parsers or body parsers.
// We need the raw Buffer to compute the HMAC — JSON.stringify(parsed) won't match.
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body, done) => {
    ;(req as typeof req & { rawBody: Buffer }).rawBody = body as Buffer
    try {
      const parsed = JSON.parse((body as Buffer).toString('utf8'))
      done(null, parsed)
    } catch (err) {
      done(err as Error, undefined)
    }
  },
)

// ─── CORS ──────────────────────────────────────────────────────────────────
await fastify.register(cors, {
  origin: [
    'https://silbon.com',
    'https://silbon.myshopify.com',
    ...(config.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:5173'] : []),
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
})

// ─── Rate limiting (subscribe endpoint) ────────────────────────────────────
await fastify.register(rateLimit, {
  global: false, // Only applied to routes that opt in
  max: 5,
  timeWindow: '10 minutes',
  keyGenerator: (request) => {
    // Rate limit per IP
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      request.ip
    )
  },
  errorResponseBuilder: (_request, context) => ({
    ok: false,
    error: 'Demasiadas solicitudes. Por favor, inténtalo de nuevo más tarde.',
    retryAfter: context.after,
  }),
})

// ─── Routes ────────────────────────────────────────────────────────────────
await fastify.register(subscribeRoute)
await fastify.register(webhookRoute)
await fastify.register(cronRoute)

// Admin routes registered in a scope (preHandler applies to all /admin/api/* routes)
await fastify.register(adminRoutes)

// ─── Admin UI (static SPA) ─────────────────────────────────────────────────
const adminDistPath = path.join(__dirname, '..', 'dist', 'admin')
try {
  await fastify.register(fastifyStatic, {
    root: adminDistPath,
    prefix: '/admin',
    decorateReply: false,
    index: 'index.html',
  })

  // SPA fallback: all /admin/* routes serve index.html for client-side routing
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/admin')) {
      return reply.sendFile('index.html', adminDistPath)
    }
    return reply.status(404).send({ error: 'Not found' })
  })
} catch {
  // Admin UI not built yet (development) — that's fine
  logger.info('Admin UI not found at dist/admin — skipping static file serving')
}

// ─── Health check ──────────────────────────────────────────────────────────
fastify.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }))

// ─── Apply rate limit to subscribe route ───────────────────────────────────
// (done at route level in subscribe.ts via config — but we set defaults globally above)

// ─── Start server ──────────────────────────────────────────────────────────
const start = async () => {
  try {
    const address = await fastify.listen({
      port: config.PORT,
      host: '0.0.0.0',
    })
    logger.info('Server started', { address, env: config.NODE_ENV })

    // Warn if Resend domain setup might be incomplete
    if (config.RESEND_API_KEY === 're_xxxxx' || config.RESEND_API_KEY.startsWith('re_test')) {
      logger.warn(
        '⚠️  RESEND_API_KEY looks like a placeholder. Verify domain at https://resend.com before going live.',
      )
    }
  } catch (err) {
    logger.error('Failed to start server', { error: err })
    process.exit(1)
  }
}

await start()
