import type { FastifyInstance } from 'fastify'
import { hmacVerify } from '../middleware/hmacVerify.js'
import { prisma } from '../db.js'
import { verifyVariantAvailable } from '../shopify.js'
import { resolveInventoryItem } from '../services/variantCacheService.js'
import { notifySubscriptionIds } from '../services/notificationService.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

interface InventoryLevelPayload {
  inventory_item_id: number
  location_id: number
  available: number
  updated_at: string
}

export async function webhookRoute(fastify: FastifyInstance) {
  fastify.post(
    '/api/webhooks/inventory-update',
    { preHandler: hmacVerify },
    async (request, reply) => {
      try {
        await processInventoryUpdate(request.body as InventoryLevelPayload)
      } catch (err) {
        logger.error('Unhandled error in inventory webhook processor', { error: err })
      }

      reply.status(200).send({})
    },
  )
}

async function processInventoryUpdate(payload: InventoryLevelPayload) {
  const { inventory_item_id, location_id, available } = payload

  logger.info('Inventory webhook received', { inventory_item_id, location_id, available })

  if (available <= 0) {
    logger.info('Skipping: location available <= 0', { inventory_item_id, available })
    return
  }

  if (config.NOTIFY_LOCATION_ID && String(location_id) !== config.NOTIFY_LOCATION_ID) {
    logger.info('Skipping: location not monitored', {
      location_id,
      monitored: config.NOTIFY_LOCATION_ID,
    })
    return
  }

  const cached = await resolveInventoryItem(String(inventory_item_id))
  if (!cached) {
    logger.error('Could not resolve inventory_item_id to variant, skipping', {
      inventory_item_id,
    })
    return
  }

  const pendingSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { variantId: cached.variantId },
        { productId: cached.productId, variantTitle: cached.variantTitle },
      ],
    },
    select: {
      id: true,
      variantId: true,
      variantTitle: true,
      productId: true,
      email: true,
    },
  })

  if (pendingSubscriptions.length === 0) {
    logger.info('No pending subscriptions for variant, nothing to do', {
      variantId: cached.variantId,
      productId: cached.productId,
      variantTitle: cached.variantTitle,
    })
    return
  }

  const exactMatchCount = pendingSubscriptions.filter((sub) => sub.variantId === cached.variantId).length
  const fallbackMatchCount = pendingSubscriptions.length - exactMatchCount

  if (fallbackMatchCount > 0) {
    logger.warn('Found pending subscriptions via fallback productId + variantTitle matching', {
      inventory_item_id,
      variantId: cached.variantId,
      productId: cached.productId,
      variantTitle: cached.variantTitle,
      exactMatchCount,
      fallbackMatchCount,
    })
  }

  logger.info('Found pending subscriptions, verifying aggregate availability', {
    variantId: cached.variantId,
    pendingCount: pendingSubscriptions.length,
  })

  let aggregateAvailable: boolean
  try {
    aggregateAvailable = await verifyVariantAvailable(cached.variantId)
  } catch (err) {
    logger.warn(
      'verifyVariantAvailable API call failed, proceeding with notifications (trusting webhook payload)',
      { variantId: cached.variantId, error: err },
    )
    aggregateAvailable = true
  }

  if (!aggregateAvailable) {
    logger.info('Variant aggregate inventory is 0, skipping notifications', {
      variantId: cached.variantId,
      location_id,
    })
    return
  }

  const result = await notifySubscriptionIds(pendingSubscriptions.map((sub) => sub.id))

  logger.info('Inventory webhook processed successfully', {
    inventory_item_id,
    variantId: cached.variantId,
    location_id,
    ...result,
  })
}
