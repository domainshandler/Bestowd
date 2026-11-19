-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "FamilyType" AS ENUM ('FAMILY', 'FRIENDS', 'SCHOOL', 'OTHER');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OccasionType" AS ENUM ('BIRTHDAY', 'HOLIDAY', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "OccasionStatus" AS ENUM ('NOT_STARTED', 'IDEA_SAVED', 'BOUGHT', 'GIVEN');

-- CreateEnum
CREATE TYPE "Rsvp" AS ENUM ('NONE', 'YES', 'NO', 'MAYBE');

-- CreateEnum
CREATE TYPE "GiftDirection" AS ENUM ('GIVEN', 'RECEIVED');

-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('BOUGHT', 'GIVEN');

-- CreateEnum
CREATE TYPE "Reaction" AS ENUM ('LOVED_IT', 'LIKED_IT', 'ALREADY_HAD_IT', 'NOT_A_HIT');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('SAVED', 'BOUGHT', 'DISMISSED');

-- CreateEnum
CREATE TYPE "InviteKind" AS ENUM ('FAMILY', 'GROUP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "identitySource" TEXT NOT NULL DEFAULT 'google',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "primaryGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "defaultBudgets" JSONB NOT NULL DEFAULT '{}',
    "defaultReminderDays" INTEGER[] DEFAULT ARRAY[14, 3]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "householdOfGroupId" TEXT,
    "name" TEXT NOT NULL,
    "type" "FamilyType" NOT NULL DEFAULT 'FAMILY',
    "status" "FamilyStatus" NOT NULL DEFAULT 'ACTIVE',
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "birthMonth" INTEGER,
    "birthDay" INTEGER,
    "birthYear" INTEGER,
    "likes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avoid" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sizes" JSONB NOT NULL DEFAULT '{}',
    "foodNotes" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occasion" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "personId" TEXT,
    "familyId" TEXT,
    "type" "OccasionType" NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recursAnnually" BOOLEAN NOT NULL DEFAULT true,
    "recurrenceEndsAt" TIMESTAMP(3),
    "nextOccurrence" TIMESTAMP(3),
    "budget" DECIMAL(10,2),
    "status" "OccasionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "needsCard" BOOLEAN NOT NULL DEFAULT false,
    "cardDone" BOOLEAN NOT NULL DEFAULT false,
    "reminderDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "partyAt" TIMESTAMP(3),
    "location" TEXT,
    "rsvp" "Rsvp" NOT NULL DEFAULT 'NONE',
    "hostGiftRequest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Occasion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftEntry" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "direction" "GiftDirection" NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "occasionId" TEXT,
    "occasionDate" TIMESTAMP(3),
    "date" TIMESTAMP(3) NOT NULL,
    "personId" TEXT,
    "familyId" TEXT,
    "amount" DECIMAL(10,2),
    "status" "GiftStatus",
    "valueHidden" BOOLEAN NOT NULL DEFAULT false,
    "hasGiftReceipt" BOOLEAN NOT NULL DEFAULT false,
    "returnBy" TIMESTAMP(3),
    "thankYouSent" BOOLEAN NOT NULL DEFAULT false,
    "thankYouDueAt" TIMESTAMP(3),
    "reaction" "Reaction",
    "photoUrl" TEXT,
    "notes" TEXT,
    "ideaId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCredit" (
    "giftEntryId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "GiftCredit_pkey" PRIMARY KEY ("giftEntryId","personId")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "url" TEXT,
    "imageUrl" TEXT,
    "price" DECIMAL(10,2),
    "notes" TEXT,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "status" "IdeaStatus" NOT NULL DEFAULT 'SAVED',
    "occasionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaPerson" (
    "ideaId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "IdeaPerson_pkey" PRIMARY KEY ("ideaId","personId")
);

-- CreateTable
CREATE TABLE "InviteLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "kind" "InviteKind" NOT NULL,
    "groupId" TEXT NOT NULL,
    "familyId" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyConnection" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "sourceFamilyId" TEXT NOT NULL,
    "sharedFields" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "GroupMembership_userId_idx" ON "GroupMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Family_householdOfGroupId_key" ON "Family"("householdOfGroupId");

-- CreateIndex
CREATE INDEX "Family_groupId_idx" ON "Family"("groupId");

-- CreateIndex
CREATE INDEX "Person_familyId_idx" ON "Person"("familyId");

-- CreateIndex
CREATE INDEX "Occasion_groupId_nextOccurrence_idx" ON "Occasion"("groupId", "nextOccurrence");

-- CreateIndex
CREATE INDEX "GiftEntry_groupId_date_idx" ON "GiftEntry"("groupId", "date");

-- CreateIndex
CREATE INDEX "Idea_groupId_idx" ON "Idea"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_token_key" ON "InviteLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyConnection_familyId_key" ON "FamilyConnection"("familyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryGroupId_fkey" FOREIGN KEY ("primaryGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_householdOfGroupId_fkey" FOREIGN KEY ("householdOfGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occasion" ADD CONSTRAINT "Occasion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occasion" ADD CONSTRAINT "Occasion_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occasion" ADD CONSTRAINT "Occasion_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftEntry" ADD CONSTRAINT "GiftEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftEntry" ADD CONSTRAINT "GiftEntry_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftEntry" ADD CONSTRAINT "GiftEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftEntry" ADD CONSTRAINT "GiftEntry_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftEntry" ADD CONSTRAINT "GiftEntry_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftEntry" ADD CONSTRAINT "GiftEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCredit" ADD CONSTRAINT "GiftCredit_giftEntryId_fkey" FOREIGN KEY ("giftEntryId") REFERENCES "GiftEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCredit" ADD CONSTRAINT "GiftCredit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaPerson" ADD CONSTRAINT "IdeaPerson_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaPerson" ADD CONSTRAINT "IdeaPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyConnection" ADD CONSTRAINT "FamilyConnection_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyConnection" ADD CONSTRAINT "FamilyConnection_sourceFamilyId_fkey" FOREIGN KEY ("sourceFamilyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one subject / counterparty (not expressible in Prisma schema; ignored by migrate diff)
ALTER TABLE "Occasion"  ADD CONSTRAINT "Occasion_one_subject"       CHECK (num_nonnulls("personId", "familyId") = 1);
ALTER TABLE "GiftEntry" ADD CONSTRAINT "GiftEntry_one_counterparty" CHECK (num_nonnulls("personId", "familyId") = 1);
