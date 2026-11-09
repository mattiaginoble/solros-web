-- CreateTable
CREATE TABLE "StorePage" (
    "url" TEXT NOT NULL PRIMARY KEY,
    "retailer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "productId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "StorePage_lastCheckedAt_idx" ON "StorePage"("lastCheckedAt");
