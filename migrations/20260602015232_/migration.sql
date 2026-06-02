-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyBelow" INTEGER;

-- CreateTable
CREATE TABLE "GridReading" (
    "id" SERIAL NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'CAISO_NORTH',
    "ts" TIMESTAMP(3) NOT NULL,
    "moer" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GridReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GridReading_region_ts_idx" ON "GridReading"("region", "ts");
