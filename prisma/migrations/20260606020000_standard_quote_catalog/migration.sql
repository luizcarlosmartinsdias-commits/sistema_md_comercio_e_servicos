-- Service catalog used by ADMIN_MD to assemble standardized quotes.
CREATE TABLE "ServiceCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "defaultUnitCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Quote"
    ADD COLUMN "quoteNumber" TEXT,
    ADD COLUMN "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "validityDays" INTEGER NOT NULL DEFAULT 7,
    ADD COLUMN "warrantyDays" INTEGER NOT NULL DEFAULT 90,
    ADD COLUMN "executionDeadlineDays" INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN "notes" TEXT,
    ADD COLUMN "pdfAttachmentId" TEXT;

ALTER TABLE "QuoteItem"
    ADD COLUMN "serviceCatalogId" TEXT;

CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

ALTER TABLE "Quote"
    ADD CONSTRAINT "Quote_pdfAttachmentId_fkey" FOREIGN KEY ("pdfAttachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteItem"
    ADD CONSTRAINT "QuoteItem_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
