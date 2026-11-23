-- AlterEnum
ALTER TYPE "FamilyType" ADD VALUE 'NEIGHBOURS';

-- AlterTable
ALTER TABLE "Occasion" ADD COLUMN     "familyTypeBudgets" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "holidayKey" TEXT,
ADD COLUMN     "includeNewFamilies" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "OccasionFamily" (
    "occasionId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "budget" DECIMAL(10,2),

    CONSTRAINT "OccasionFamily_pkey" PRIMARY KEY ("occasionId","familyId")
);

-- CreateIndex
CREATE INDEX "OccasionFamily_familyId_idx" ON "OccasionFamily"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Occasion_groupId_holidayKey_key" ON "Occasion"("groupId", "holidayKey");

-- AddForeignKey
ALTER TABLE "OccasionFamily" ADD CONSTRAINT "OccasionFamily_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccasionFamily" ADD CONSTRAINT "OccasionFamily_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Group-wide occasions have no person or family; any other occasion still has exactly one.
-- Only group-wide occasions can be a built-in holiday.
ALTER TABLE "Occasion" DROP CONSTRAINT "Occasion_one_subject";
ALTER TABLE "Occasion" ADD CONSTRAINT "Occasion_at_most_one_subject" CHECK (num_nonnulls("personId", "familyId") <= 1);
ALTER TABLE "Occasion" ADD CONSTRAINT "Occasion_holiday_is_group_wide" CHECK ("holidayKey" IS NULL OR num_nonnulls("personId", "familyId") = 0);
