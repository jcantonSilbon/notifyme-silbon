ALTER TABLE "Subscription"
ADD COLUMN "inventoryItemId" TEXT;

CREATE INDEX "Subscription_inventoryItemId_status_idx"
ON "Subscription"("inventoryItemId", "status");
