import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON;");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ManagerProfile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "responseLatencyHours" INTEGER NOT NULL,
      "infoDensity" TEXT NOT NULL,
      "proactiveCadence" TEXT NOT NULL,
      "prefersConclusionFirst" BOOLEAN NOT NULL DEFAULT true,
      "riskTolerance" TEXT NOT NULL,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WorkItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "rawMessage" TEXT NOT NULL,
      "conversationContext" TEXT,
      "mainlineTask" TEXT NOT NULL,
      "thinking" TEXT NOT NULL,
      "plan" TEXT NOT NULL,
      "timeline" TEXT NOT NULL,
      "expectedOutput" TEXT NOT NULL,
      "neededResources" JSONB NOT NULL,
      "decisionType" TEXT NOT NULL,
      "decisionReasoning" TEXT NOT NULL,
      "decisionConfidence" INTEGER NOT NULL,
      "missingInputs" JSONB NOT NULL,
      "recommendedEscalation" TEXT NOT NULL,
      "mainlinePriority" TEXT NOT NULL,
      "workStatus" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      "nextManagerUpdateAt" DATETIME NOT NULL,
      "riskOrBlocker" TEXT NOT NULL,
      "replyDraft" TEXT NOT NULL,
      "analysisVersion" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      "managerProfileId" TEXT NOT NULL,
      CONSTRAINT "WorkItem_managerProfileId_fkey"
        FOREIGN KEY ("managerProfileId") REFERENCES "ManagerProfile" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FollowUp" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "dueAt" DATETIME NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      "workItemId" TEXT NOT NULL,
      CONSTRAINT "FollowUp_workItemId_fkey"
        FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  console.log("Database schema bootstrapped.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
