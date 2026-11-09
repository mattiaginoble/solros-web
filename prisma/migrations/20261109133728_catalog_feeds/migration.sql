-- CreateTable
CREATE TABLE "CatalogFeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mapping" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'cm',
    "retailer" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "lastRunAt" DATETIME,
    "lastStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatalogFeed_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogFeed_ownerId_name_key" ON "CatalogFeed"("ownerId", "name");
