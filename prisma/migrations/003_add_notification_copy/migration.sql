CREATE TABLE "NotificationCopy" (
  "locale" TEXT NOT NULL,
  "triggerButtonText" TEXT NOT NULL,
  "modalTitle" TEXT NOT NULL,
  "sizeSelectLabel" TEXT NOT NULL,
  "emailLabel" TEXT NOT NULL,
  "emailPlaceholder" TEXT NOT NULL,
  "submitButtonText" TEXT NOT NULL,
  "successMessage" TEXT NOT NULL,
  "selectVariantMessage" TEXT NOT NULL,
  "invalidEmailMessage" TEXT NOT NULL,
  "genericErrorMessage" TEXT NOT NULL,
  "connectionErrorMessage" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationCopy_pkey" PRIMARY KEY ("locale")
);
