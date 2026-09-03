-- CreateTable
CREATE TABLE "CrochetTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "imagePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CrochetTermAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alias" TEXT NOT NULL,
    "aliasNormalized" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrochetTermAlias_termId_fkey" FOREIGN KEY ("termId") REFERENCES "CrochetTerm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CrochetTerm_code_key" ON "CrochetTerm"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CrochetTermAlias_aliasNormalized_key" ON "CrochetTermAlias"("aliasNormalized");

-- CreateIndex
CREATE INDEX "CrochetTermAlias_termId_idx" ON "CrochetTermAlias"("termId");
