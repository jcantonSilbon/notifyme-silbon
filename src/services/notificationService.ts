import { prisma } from '../db.js'
import { Prisma } from '@prisma/client'
import { sendBackInStockEmail } from '../email/sender.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

const MAX_RETRIES = 3
const RETRY_BACKOFF_MINUTES = 30

// A stuck processingAt older than this is considered abandoned (e.g. function crash)
// and will be re-claimed by the next webhook or cron run.
const PROCESSING_TIMEOUT_MINUTES = 10

/**
 * Builds the product URL for the email CTA.
 * Uses the stored productHandle so the URL resolves correctly regardless of
 * how Shopify's internal routing changes. The ?variant= query parameter ensures
 * the correct option (e.g. size M) is pre-selected when the customer clicks through.
 *
 * Example: https://silbon.com/products/camiseta-manga-larga?variant=12345678
 */
function buildProductUrl(productHandle: string, variantId: string): string {
  return `${config.STORE_URL}/products/${productHandle}?variant=${variantId}`
}

/**
 * Sends notifications for a batch of already-claimed subscriptions.
 * Processes sequentially to avoid Resend rate limits.
 * Clears processingAt on both success and failure — always releases the claim.
 */
async function notifyBatch(
  subscriptions: Array<{
    id: string
    email: string
    productHandle: string
    productTitle: string
    variantTitle: string
    productId: string
    variantId: string
    retryCount: number
  }>,
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0
  let failed = 0

  for (const sub of subscriptions) {
    try {
      const productUrl = buildProductUrl(sub.productHandle, sub.variantId)

      await sendBackInStockEmail({
        to: sub.email,
        productTitle: sub.productTitle,
        variantTitle: sub.variantTitle,
        productUrl,
        productId: sub.productId,
        variantId: sub.variantId,
      })

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'NOTIFIED',
          notifiedAt: new Date(),
          lastAttemptAt: new Date(),
          processingAt: null, // release claim
          errorMessage: null,
        },
      })

      logger.info('Notification sent', { email: sub.email, variantId: sub.variantId })
      succeeded++
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      const newRetryCount = sub.retryCount + 1
      const newStatus = newRetryCount >= MAX_RETRIES ? 'FAILED' : 'PENDING'

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          retryCount: newRetryCount,
          status: newStatus,
          lastAttemptAt: new Date(),
          processingAt: null, // release claim so cron can retry
          errorMessage,
        },
      })

      logger.error('Failed to send notification', {
        email: sub.email,
        variantId: sub.variantId,
        retryCount: newRetryCount,
        newStatus,
        error: errorMessage,
      })
      failed++
    }
  }

  return { succeeded, failed }
}

/**
 * Triggered by the inventory webhook.
 * Atomically claims all PENDING subscriptions for the given variantId via a single
 * UPDATE ... RETURNING query, then sends notifications for the claimed rows.
 *
 * The atomic claim prevents duplicate sends when Shopify delivers the same webhook
 * twice (it retries on non-2xx or network issues) or when two webhook invocations
 * race. The second invocation finds 0 claimable rows and exits immediately.
 *
 * The PROCESSING_TIMEOUT_MINUTES guard re-opens rows whose processingAt is stale
 * (e.g. function crashed before clearing it), so the cron or a later webhook can
 * recover them without manual intervention.
 */
export async function notifyVariantSubscribers(variantId: string): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  // Atomically claim unclaimed PENDING rows for this variant.
  // "Unclaimed" means processingAt IS NULL or was set more than PROCESSING_TIMEOUT_MINUTES ago.
  const claimedRows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      UPDATE "Subscription"
      SET "processingAt" = NOW()
      WHERE "variantId" = ${variantId}
        AND status = 'PENDING'::"SubscriptionStatus"
        AND (
          "processingAt" IS NULL
          OR "processingAt" < NOW() - (${PROCESSING_TIMEOUT_MINUTES} || ' minutes')::INTERVAL
        )
      RETURNING id
    `,
  )

  if (claimedRows.length === 0) {
    logger.info('No claimable pending subscriptions for variant — already claimed or none exist', {
      variantId,
    })
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  const ids = claimedRows.map((r) => r.id)
  const subscriptions = await prisma.subscription.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: 'asc' },
  })

  logger.info('Claimed subscriptions for processing', { variantId, count: subscriptions.length })
  const result = await notifyBatch(subscriptions)

  return { processed: subscriptions.length, ...result }
}

/**
 * Retries subscriptions that previously failed to send.
 * Uses the same atomic claim pattern as notifyVariantSubscribers to prevent
 * concurrent cron invocations from sending duplicate emails.
 *
 * Note: does NOT re-verify inventory availability before sending.
 * The email copy says "was restocked" not "is currently in stock", so this
 * is intentional — we notify even if the item sold out again since the restock.
 */
export async function retryFailed(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const cutoff = new Date(Date.now() - RETRY_BACKOFF_MINUTES * 60 * 1000)

  const claimedRows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      UPDATE "Subscription"
      SET "processingAt" = NOW()
      WHERE status = 'PENDING'::"SubscriptionStatus"
        AND "retryCount" > 0
        AND "retryCount" < ${MAX_RETRIES}
        AND "lastAttemptAt" < ${cutoff}
        AND (
          "processingAt" IS NULL
          OR "processingAt" < NOW() - (${PROCESSING_TIMEOUT_MINUTES} || ' minutes')::INTERVAL
        )
      RETURNING id
    `,
  )

  if (claimedRows.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  const ids = claimedRows.map((r) => r.id)
  const candidates = await prisma.subscription.findMany({
    where: { id: { in: ids } },
    orderBy: { lastAttemptAt: 'asc' },
  })

  logger.info('Retrying failed notifications', { count: candidates.length })
  const result = await notifyBatch(candidates)

  return { processed: candidates.length, ...result }
}
