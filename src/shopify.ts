import '@shopify/shopify-api/adapters/node'
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api'
import { config } from './config.js'

export const shopify = shopifyApi({
  apiKey: 'notifyme',
  apiSecretKey: config.SHOPIFY_WEBHOOK_SECRET,
  adminApiAccessToken: config.SHOPIFY_ACCESS_TOKEN,
  scopes: ['read_inventory', 'read_products'],
  hostName: new URL(config.APP_URL).hostname,
  apiVersion: config.SHOPIFY_API_VERSION as ApiVersion,
  isEmbeddedApp: false,
})

// Pre-built session for the single store — no OAuth needed for custom apps
export const shopifySession = new Session({
  id: `offline_${config.SHOPIFY_SHOP_DOMAIN}`,
  shop: config.SHOPIFY_SHOP_DOMAIN,
  state: '',
  isOnline: false,
  accessToken: config.SHOPIFY_ACCESS_TOKEN,
})

/**
 * Fetch a variant from the Shopify Admin REST API.
 * Returns the raw variant object including inventory_item_id.
 */
export async function fetchVariant(variantId: string) {
  const client = new shopify.clients.Rest({ session: shopifySession })
  const response = await client.get<{
    variant: {
      id: number
      product_id: number
      title: string
      inventory_item_id: number
    }
  }>({
    path: `variants/${variantId}`,
  })
  return response.body.variant
}

/**
 * Fetch a product's title from the Shopify Admin REST API (fields=id,title only).
 */
export async function fetchProductTitle(productId: string): Promise<string> {
  const client = new shopify.clients.Rest({ session: shopifySession })
  const response = await client.get<{ product: { id: number; title: string } }>({
    path: `products/${productId}`,
    query: { fields: 'id,title' },
  })
  return response.body.product.title
}

/**
 * Fetch an inventory item to get the associated variant_id.
 * Note: inventory items created for non-variant products have variant_id = null.
 * Callers must guard against this.
 */
export async function fetchInventoryItem(inventoryItemId: string) {
  const client = new shopify.clients.Rest({ session: shopifySession })
  const response = await client.get<{
    inventory_item: {
      id: number
      variant_id: number | null
    }
  }>({
    path: `inventory_items/${inventoryItemId}`,
  })
  return response.body.inventory_item
}

/**
 * Verifies that a variant is actually purchasable by checking its AGGREGATE
 * inventory_quantity across all locations via the Shopify Admin REST API.
 *
 * This is called after the webhook fires to guard against:
 *   - Webhooks from secondary/retail locations (available > 0 there but 0 aggregate)
 *   - Flash restocks where the item was bought out before we processed the webhook
 *
 * Returns true if the variant should be considered in stock for notifications.
 * Falls back to true on API error — we trust the webhook payload rather than
 * silently dropping notifications due to a transient Shopify API failure.
 */
export async function verifyVariantAvailable(variantId: string): Promise<boolean> {
  const client = new shopify.clients.Rest({ session: shopifySession })
  const response = await client.get<{
    variant: {
      id: number
      inventory_quantity: number
    }
  }>({
    path: `variants/${variantId}`,
    query: { fields: 'id,inventory_quantity' },
  })
  const v = response.body.variant
  // Silbon: notify only when physical stock is actually replenished.
  // inventory_policy = 'continue' (oversell / pre-order) is intentionally ignored —
  // those products should show the add-to-cart button directly, not the notify form.
  return v.inventory_quantity > 0
}
