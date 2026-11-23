-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Person_groupId_userId_key" ON "Person"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Everyone who signs in to a group becomes a person in its household.
INSERT INTO "Person" ("id", "groupId", "familyId", "userId", "name", "updatedAt")
SELECT 'acct' || md5(m."groupId" || m."userId"), m."groupId", f."id", m."userId", u."name", now()
FROM "GroupMembership" m
JOIN "Family" f ON f."householdOfGroupId" = m."groupId"
JOIN "User" u ON u."id" = m."userId"
ON CONFLICT DO NOTHING;
