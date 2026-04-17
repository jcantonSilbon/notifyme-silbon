import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { validateEmail, normalizeEmail } from '../utils/emailValidator.js'
import { warmCacheForVariant } from './variantCacheService.js'
import { logger } from '../utils/logger.js'

export const SubscribeInputSchema = z.object({
  email: z.string().min(1).max(320),
  productId: z.string().min(1).max(64),
  productHandle: z.string().min(1).max(255),
  variantId: z.string().min(1).max(64),
  inventoryItemId: z.string().min(1).max(64).optional(),
  productTitle: z.string().min(1).max(255),
  variantTitle: z.string().min(1).max(255),
  honeypot: z.string().max(0, 'Bot detected'), // must be empty string
})

export type SubscribeInput = z.infer<typeof SubscribeInputSchema>

type SubscribeResult =
  | { status: 'created' }
  | { status: 'duplicate' }
  | { status: 'invalid'; error: string }

export async function createSubscription(raw: unknown): Promise<SubscribeResult> {
  // Validate shape
  const parsed = SubscribeInputSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    // Honeypot triggered
    if (firstError?.path[0] === 'honeypot') {
      logger.warn('Honeypot triggered', { raw })
      return { status: 'invalid', error: 'Invalid request' }
    }
    return { status: 'invalid', error: firstError?.message ?? 'Datos inválidos' }
  }

  const {
    email: rawEmail,
    productId,
    productHandle,
    variantId,
    inventoryItemId,
    productTitle,
    variantTitle,
  } = parsed.data
  const email = normalizeEmail(rawEmail)

  // Validate email format + DNS
  const emailError = await validateEmail(email)
  if (emailError) {
    return { status: 'invalid', error: emailError }
  }

  // Check for existing PENDING subscription (application-level check before DB constraint)
  const existing = await prisma.subscription.findFirst({
    where: { email, variantId, status: 'PENDING' },
  })
  if (existing) {
    return { status: 'duplicate' }
  }

  // Create the subscription.
  // The partial unique index `unique_pending_sub` (email, variantId) WHERE status='PENDING'
  // is the authoritative DB-level guard. The findFirst check above handles the common
  // case; this try/catch handles the race condition where two concurrent requests both
  // pass the check and then race to INSERT.
  try {
    await prisma.subscription.create({
      data: {
        email,
        productId,
        productHandle,
        variantId,
        inventoryItemId,
        productTitle,
        variantTitle,
        status: 'PENDING',
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Unique constraint violated — concurrent duplicate request
      logger.info('Duplicate subscription caught by DB constraint', { email, variantId })
      return { status: 'duplicate' }
    }
    throw err
  }

  logger.info('Subscription created', { email, variantId, productTitle, variantTitle })

  // Warm the VariantCache in the background — don't await (fire-and-forget)
  // This ensures the cache is populated before the first webhook fires
  warmCacheForVariant(variantId).catch((err) => {
    logger.warn('Background cache warm failed', { variantId, error: err })
  })

  return { status: 'created' }
}

export async function getSubscriptions(params: {
  page: number
  limit: number
  status?: string
  productId?: string
  variantId?: string
  search?: string
}) {
  const { page, limit, status, productId, variantId, search } = params
  const skip = (page - 1) * limit

  const where = {
    ...(status ? { status: status as 'PENDING' | 'NOTIFIED' | 'FAILED' } : {}),
    ...(productId ? { productId } : {}),
    ...(variantId ? { variantId } : {}),
    ...(search ? { email: { contains: search, mode: 'insensitive' as const } } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.subscription.count({ where }),
  ])

  return { data, total, page, limit }
}

export async function getStats() {
  const [pending, notified, failed, topVariants] = await Promise.all([
    prisma.subscription.count({ where: { status: 'PENDING' } }),
    prisma.subscription.count({ where: { status: 'NOTIFIED' } }),
    prisma.subscription.count({ where: { status: 'FAILED' } }),
    prisma.subscription.groupBy({
      by: ['variantId', 'variantTitle', 'productTitle', 'productId'],
      where: { status: 'PENDING' },
      _count: { variantId: true },
      orderBy: { _count: { variantId: 'desc' } },
      take: 10,
    }),
  ])

  return {
    totalPending: pending,
    totalNotified: notified,
    totalFailed: failed,
    topVariants: topVariants.map((v) => ({
      variantId: v.variantId,
      variantTitle: v.variantTitle,
      productTitle: v.productTitle,
      productId: v.productId,
      count: v._count.variantId,
    })),
  }
}

export async function deleteSubscription(id: string) {
  await prisma.subscription.delete({
    where: { id },
  })
}

export async function forceRetrySubscription(id: string) {
  await prisma.subscription.update({
    where: { id },
    data: { status: 'PENDING', retryCount: 0, errorMessage: null },
  })
}
