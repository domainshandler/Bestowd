-- CreateEnum
CREATE TYPE "MoveStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MoveRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fromGroupId" TEXT,
    "fromGroupName" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "familyIds" TEXT[],
    "occasionIds" TEXT[],
    "ideas" BOOLEAN NOT NULL DEFAULT false,
    "status" "MoveStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoveRequest_groupId_status_idx" ON "MoveRequest"("groupId", "status");

-- AddForeignKey
ALTER TABLE "MoveRequest" ADD CONSTRAINT "MoveRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveRequest" ADD CONSTRAINT "MoveRequest_fromGroupId_fkey" FOREIGN KEY ("fromGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveRequest" ADD CONSTRAINT "MoveRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveRequest" ADD CONSTRAINT "MoveRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One pending request per source group.
CREATE UNIQUE INDEX "MoveRequest_one_pending_per_source" ON "MoveRequest"("fromGroupId") WHERE "status" = 'PENDING';
