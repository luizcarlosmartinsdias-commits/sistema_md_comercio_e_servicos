CREATE TYPE "WarrantyStatus" AS ENUM ('ATIVA', 'VENCIDA', 'SOLICITACAO_ABERTA', 'EM_ANALISE', 'APROVADA', 'RECUSADA', 'FINALIZADA');

CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "quoteId" TEXT,
    "companyId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "warrantyDays" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'ATIVA',
    "issueDescription" TEXT,
    "decisionNote" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Warranty_serviceRequestId_key" ON "Warranty"("serviceRequestId");
CREATE INDEX "Warranty_companyId_idx" ON "Warranty"("companyId");
CREATE INDEX "Warranty_requesterId_idx" ON "Warranty"("requesterId");
CREATE INDEX "Warranty_status_idx" ON "Warranty"("status");
CREATE INDEX "Warranty_endDate_idx" ON "Warranty"("endDate");

ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
