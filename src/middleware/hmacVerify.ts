import crypto from 'crypto'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

/**
 * Shopify webhook HMAC verification middleware.
 *
 * CRITICAL: Must use the raw request body buffer, NOT parsed JSON.
 * Any re-serialization of the JSON payload will change whitespace and break the HMAC.
 *
 * The route must be registered with `{ config: { rawBody: true } }` or
 * Fastify must be configured with addContentTypeParser to capture rawBody.
 */
export async function hmacVerify(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const hmacHeader = request.headers['x-shopify-hmac-sha256'] as string | undefined
  const shopDomain = request.headers['x-shopify-shop-domain'] as string | undefined

  if (!hmacHeader) {
    logger.warn('Webhook rejected: missing HMAC header')
    await reply.status(401).send({ error: 'Missing HMAC' })
    return
  }

  // Validate the webhook is from our expected store
  if (shopDomain && shopDomain !== config.SHOPIFY_SHOP_DOMAIN) {
    logger.warn('Webhook rejected: wrong shop domain', { shopDomain })
    await reply.status(401).send({ error: 'Unexpected shop domain' })
    return
  }

  // rawBody is attached by the content type parser in index.ts
  const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody
  if (!rawBody) {
    logger.error('Webhook rejected: raw body not available — check content type parser setup')
    await reply.status(400).send({ error: 'No raw body available' })
    return
  }

  const digest = crypto
    .createHmac('sha256', config.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64')

  // timingSafeEqual prevents timing oracle attacks on the comparison
  let isValid = false
  try {
    const hmacBuffer = Buffer.from(hmacHeader, 'base64')
    const digestBuffer = Buffer.from(digest, 'base64')
    if (hmacBuffer.length === digestBuffer.length) {
      isValid = crypto.timingSafeEqual(digestBuffer, hmacBuffer)
    }
  } catch {
    isValid = false
  }

  if (!isValid) {
    logger.warn('Webhook rejected: invalid HMAC', { shopDomain })
    await reply.status(401).send({ error: 'Invalid HMAC' })
    return
  }
}
