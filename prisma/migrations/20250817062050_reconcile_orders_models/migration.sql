/*
  Warnings:

  - You are about to drop the column `emergencyFeeCLP` on the `GlobalConfig` table. All the data in the column will be lost.
  - You are about to drop the column `emergencySchedule` on the `GlobalConfig` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `OrderStatusLog` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `OrderStatusLog` table. All the data in the column will be lost.
  - Added the required column `productTitle` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `to` to the `OrderStatusLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN "extraCost" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GlobalConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "emergencyExtraCost" INTEGER,
    "emergencyDays" TEXT,
    "emergencyHours" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_GlobalConfig" ("createdAt", "id", "updatedAt") SELECT "createdAt", "id", "updatedAt" FROM "GlobalConfig";
DROP TABLE "GlobalConfig";
ALTER TABLE "new_GlobalConfig" RENAME TO "GlobalConfig";
CREATE TABLE "new_OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "productTitle" TEXT NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("id", "orderId", "productId", "quantity") SELECT "id", "orderId", "productId", "quantity" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE TABLE "new_OrderStatusLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "changedBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStatusLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderStatusLog_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderStatusLog" ("createdAt", "id", "orderId") SELECT "createdAt", "id", "orderId" FROM "OrderStatusLog";
DROP TABLE "OrderStatusLog";
ALTER TABLE "new_OrderStatusLog" RENAME TO "OrderStatusLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
