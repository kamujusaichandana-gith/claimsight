ALTER TABLE "Claim"
ADD COLUMN "summary" JSONB,
ADD COLUMN "summaryGeneratedAt" TIMESTAMP(3),
ADD COLUMN "summaryModel" TEXT;

CREATE TABLE "ClaimSummaryUsage" (
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClaimSummaryUsage_pkey" PRIMARY KEY ("day")
);
