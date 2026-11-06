-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Ospite',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "shareToken" TEXT,
    "isExample" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "width" REAL NOT NULL,
    "depth" REAL NOT NULL,
    "height" REAL NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "color" TEXT,
    "colorHex" TEXT,
    "imageUrl" TEXT,
    "url" TEXT,
    "mount" TEXT NOT NULL DEFAULT 'floor',
    "elevation" REAL,
    "clearanceFront" REAL NOT NULL DEFAULT 0,
    "clearanceSides" REAL NOT NULL DEFAULT 0,
    "modelUrl" TEXT,
    "shape" TEXT,
    "meta" TEXT,
    "importBatch" TEXT,
    "ownerId" TEXT,
    "priceUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project"("shareToken");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_retailer_idx" ON "Product"("retailer");

-- CreateIndex
CREATE INDEX "Product_source_idx" ON "Product"("source");

-- CreateIndex
CREATE INDEX "Product_ownerId_idx" ON "Product"("ownerId");
