import type { FastifyInstance } from 'fastify'
import { hmacVerify } from '../middleware/hmacVerify.js'
import { prisma } from '../db.js'
import { verifyVariantAvailable } from '../shopify.js'
import { resolveInventoryItem } from '../services/variantCacheService.js'
import { notifyVariantSubscribers } from '../services/notificationService.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

interface InventoryLevelPayload {
  inventory_item_id: number
  location_id: number
  available: number    // per-location count — NOT the aggregate across all locations
  updated_at: string
}

export async function webhookRoute(fastify: FastifyInstance) {
  fastify.post(
    '/api/webhooks/inventory-update',
    { preHandler: hmacVerify },
    async (request, reply) => {
      // Process synchronously then return 200.
      //
      // Why this is safe despite Shopify's 5-second delivery timeout:
      //   • The hot path (available ≤ 0, wrong location, no subscribers) returns in < 100 ms.
      //   • The full path (aggregate check + emails) is bounded by Silbon's subscriber
      //     volume — a few dozen emails via Resend comfortably fits inside 5 seconds.
      //   • If processing does exceed 5 seconds, Shopify retries the webhook. The retry
      //     finds 0 claimable rows (processingAt is already set) and exits in < 100 ms.
      //     No duplicate emails are sent. The original invocation finishes normally.
      //   • If the Vercel function crashes mid-send, processingAt remains set on the
      //     affected rows. The cron job re-opens them after PROCESSING_TIMEOUT_MINUTES
      //     and retries — no manual intervention needed.
      //
      // If subscriber volume ever grows large (hundreds per variant), move email sending
      // to a queue (Vercel Queue, pg_notify, or a DB job table) and keep this handler
      // as a thin enqueue step.
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

  // ── Step 1: Guard — per-location count must be positive ──────────────────
  // `available` here is the count at a specific warehouse location, not the aggregate.
  // We still need this check because it filters out all sell-down events (0 or negative).
  if (available <= 0) {
    logger.info('Skipping: location available <= 0', { inventory_item_id, available })
    return
  }

  // ── Step 2: Location filter ───────────────────────────────────────────────
  // If NOTIFY_LOCATION_ID is set, only process webhooks from that location.
  // For Silbon (single warehouse): set this to the main warehouse location ID to
  // avoid false positives from retail or outlet locations.
  if (config.NOTIFY_LOCATION_ID && String(location_id) !== config.NOTIFY_LOCATION_ID) {
    logger.info('Skipping: location not monitored', {
      location_id,
      monitored: config.NOTIFY_LOCATION_ID,
    })
    return
  }

  // ── Step 3: Resolve inventory_item_id → variantId ─────────────────────────
  // DB cache-first. On cache miss: 3 Shopify Admin API calls (see variantCacheService.ts).
  // Cache is warmed at subscribe time so misses are rare in practice.
  const cached = await resolveInventoryItem(String(inventory_item_id))
  if (!cached) {
    logger.error('Could not resolve inventory_item_id to variant — skipping', {
      inventory_item_id,
    })
    return
  }

  // ── Step 4: Early exit — no pending subscriptions ─────────────────────────
  // Check the DB before making the Shopify API verification call.
  // Most restock events are for variants nobody subscribed to — this is cheap and avoids
  // an unnecessary API call in the vast majority of webhook events.
  const pendingCount = await prisma.subscription.count({
    where: { variantId: cached.variantId, status: 'PENDING' },
  })
  if (pendingCount === 0) {
    logger.info('No pending subscriptions for variant — nothing to do', {
      variantId: cached.variantId,
    })
    return
  }

  logger.info('Found pending subscriptions, verifying aggregate availability', {
    variantId: cached.variantId,
    pendingCount,
  })

  // ── Step 5: Final aggregate availability check ────────────────────────────
  // The webhook `available` is per-location. Before sending emails, verify that the
  // variant's AGGREGATE inventory_quantity (across all locations) is positive.
  //
  // This guards against:
  //   a) Multi-location: webhook fires for a retail outlet (available=2 there) while
  //      the online warehouse is still at 0. Without this check, subscribers would
  //      receive an email for an item they cannot actually buy online.
  //   b) Flash restock: webhook fires, item immediately sells out before we process.
  //      Subscribers get an email; they click and the item is gone. This is unavoidable
  //      at the millisecond level but the check reduces the window significantly.
  //
  // On API failure: proceed with notifications rather than silently drop them.
  // A Shopify API outage should not permanently prevent a customer from being notified.
  let aggregateAvailable: boolean
  try {
    aggregateAvailable = await verifyVariantAvailable(cached.variantId)
  } catch (err) {
    logger.warn(
      'verifyVariantAvailable API call failed — proceeding with notifications (trusting webhook payload)',
      { variantId: cached.variantId, error: err },
    )
    aggregateAvailable = true
  }

  if (!aggregateAvailable) {
    logger.info(
      'Variant aggregate inventory is 0 — webhook was from a secondary location or item already sold out; skipping notifications',
      { variantId: cached.variantId, location_id },
    )
    return
  }

  // ── Step 6: Notify all pending subscribers ────────────────────────────────
  // notifyVariantSubscribers re-queries the DB for PENDING subs immediately before
  // sending, so even if a sub was deleted between our count check and now, it's safe.
  const result = await notifyVariantSubscribers(cached.variantId)

  logger.info('Inventory webhook processed successfully', {
    inventory_item_id,
    variantId: cached.variantId,
    location_id,
    ...result,
  })
}
