CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "PolicyDocumentChunk" (
    "id" TEXT NOT NULL,
    "policyType" "PolicyType" NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyDocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PolicyDocumentChunk_policyType_sectionTitle_contentHash_key"
ON "PolicyDocumentChunk"("policyType", "sectionTitle", "contentHash");

CREATE INDEX "PolicyDocumentChunk_policyType_idx"
ON "PolicyDocumentChunk"("policyType");

CREATE INDEX "PolicyDocumentChunk_embedding_hnsw_idx"
ON "PolicyDocumentChunk" USING hnsw ("embedding" vector_cosine_ops);
