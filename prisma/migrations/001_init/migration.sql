-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'NOTIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL DEFAULT 'silbon.myshopify.com',
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "productHandle" TEXT NOT NULL DEFAULT '',
    "processingAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantCache" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_variantId_status_idx" ON "Subscription"("variantId", "status");

-- CreateIndex
CREATE INDEX "Subscription_productId_idx" ON "Subscription"("productId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_createdAt_idx" ON "Subscription"("createdAt");

-- CreateIndex
CREATE INDEX "Subscription_email_idx" ON "Subscription"("email");

-- Partial unique index: one PENDING subscription per (email, variantId)
-- This allows re-subscription after NOTIFIED/FAILED but prevents duplicates while PENDING
CREATE UNIQUE INDEX "unique_pending_sub"
    ON "Subscription"(email, "variantId")
    WHERE status = 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX "VariantCache_inventoryItemId_key" ON "VariantCache"("inventoryItemId");

-- CreateIndex
CREATE INDEX "VariantCache_variantId_idx" ON "VariantCache"("variantId");
