/**
 * Builds and returns the Fastify app, ready for use.
 *
 * Exported as an async factory (not a module singleton with top-level await)
 * so it works in both:
 *   - ESM + top-level await contexts (local dev via tsx)
 *   - CJS bundle contexts (Vercel's @vercel/node esbuild output, which doesn't
 *     support top-level await at module scope)
 *
 * The caller is responsible for caching the returned promise.
 */
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'

import { config } from './config.js'
import { subscribeRoute } from './routes/subscribe.js'
import { copyRoute } from './routes/copy.js'
import { webhookRoute } from './routes/webhook.js'
import { cronRoute } from './routes/cron.js'
import { adminRoutes } from './routes/admin/index.js'
import { logger } from './utils/logger.js'

export async function buildApp() {
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
      'https://silbon-staging-v2.myshopify.com',
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
  await fastify.register(copyRoute)
  await fastify.register(webhookRoute)
  await fastify.register(cronRoute)
  await fastify.register(adminRoutes)

  // Admin UI static files.
  // __dirname is src/ in dev (tsx) and dist/ after tsc compilation.
  // In both cases the built admin assets live at <root>/dist/admin.
  const adminDistPath = path.resolve(__dirname, '..', 'dist', 'admin')
  try {
    await fastify.register(fastifyStatic, {
      root: adminDistPath,
      prefix: '/admin',
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
  return fastify
}

// Vercel serverless handler.
// @vercel/node compiles src/app.ts in-place to src/app.js and uses it as the
// function entry module — it requires the default export to be a function or server.
let _appPromise: ReturnType<typeof buildApp> | null = null

export default async function handler(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
): Promise<void> {
  if (!_appPromise) _appPromise = buildApp()
  const app = await _appPromise
  app.server.emit('request', req, res)
}
