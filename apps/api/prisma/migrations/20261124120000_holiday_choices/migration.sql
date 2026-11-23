-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "dismissedHolidays" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "holidaysChosenAt" TIMESTAMP(3);

