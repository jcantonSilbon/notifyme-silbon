import { prisma } from '../db.js'
import { fetchVariant, fetchProductTitle, fetchVariantByInventoryItem } from '../shopify.js'
import { logger } from '../utils/logger.js'

/**
 * Warms the VariantCache for a given variantId.
 * Called fire-and-forget after a subscription is created so the cache is
 * populated before the first webhook fires.
 */
export async function warmCacheForVariant(variantId: string): Promise<void> {
  try {
    // Check if already cached
    const existing = await prisma.variantCache.findFirst({
      where: { variantId },
    })
    if (existing) return

    const variant = await fetchVariant(variantId)
    const productTitle = await fetchProductTitle(String(variant.product_id))

    await prisma.variantCache.upsert({
      where: { inventoryItemId: String(variant.inventory_item_id) },
      create: {
        inventoryItemId: String(variant.inventory_item_id),
        variantId: String(variant.id),
        productId: String(variant.product_id),
        productTitle,
        variantTitle: variant.title,
      },
      update: {
        variantId: String(variant.id),
        productId: String(variant.product_id),
        productTitle,
        variantTitle: variant.title,
      },
    })

    logger.info('VariantCache warmed', { variantId, inventoryItemId: variant.inventory_item_id })
  } catch (err) {
    // Non-fatal: the cache will be populated on the first webhook cache miss
    logger.warn('Failed to warm VariantCache', { variantId, error: err })
  }
}

/**
 * Resolves an inventory_item_id to a VariantCache entry.
 * DB cache-first: only calls Shopify API on a cache miss.
 * Returns null if the variant could not be resolved (Shopify API error).
 */
export async function resolveInventoryItem(inventoryItemId: string) {
  // 1. Cache hit
  const cached = await prisma.variantCache.findUnique({
    where: { inventoryItemId },
  })
  if (cached) return cached

  // 2. Cache miss — resolve via Shopify API
  logger.info('VariantCache miss, fetching from Shopify API', { inventoryItemId })

  try {
    // variants.json?inventory_item_ids={id} is the correct way to resolve
    // inventory_item_id → variant in API 2024-10+.
    // inventory_items/{id}.json no longer includes variant_id.
    const variant = await fetchVariantByInventoryItem(inventoryItemId)

    if (!variant) {
      logger.info('Skipping: no variant found for inventory item', { inventoryItemId })
      return null
    }

    const variantId = String(variant.id)
    const productTitle = await fetchProductTitle(String(variant.product_id))

    const entry = await prisma.variantCache.upsert({
      where: { inventoryItemId },
      create: {
        inventoryItemId,
        variantId,
        productId: String(variant.product_id),
        productTitle,
        variantTitle: variant.title,
      },
      update: {
        variantId,
        productId: String(variant.product_id),
        productTitle,
        variantTitle: variant.title,
      },
    })


    logger.info('VariantCache populated from API', { inventoryItemId, variantId })
    return entry
  } catch (err) {
    logger.error('Failed to resolve inventory_item_id via Shopify API', {
      inventoryItemId,
      error: err,
    })
    return null
  }
}
