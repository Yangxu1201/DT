import { prisma } from "./db";

let bootstrapPromise: Promise<void> | null = null;

/**
 * Schema bootstrap
 * ----------------
 * We keep Prisma as the data access layer, but we do not block v1 on Prisma's
 * migration engine. On this machine the schema engine is flaky. SQLite itself is not.
 *
 * So the first application request makes sure the database file and core tables exist.
 * Boring. Explicit. Good enough for a first internal tool.
 */
export async function ensureDatabaseReady() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
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
        "draftSource" TEXT NOT NULL DEFAULT 'deterministic',
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
      ALTER TABLE "WorkItem"
      ADD COLUMN "draftSource" TEXT NOT NULL DEFAULT 'deterministic';
    `).catch(() => {
      // Existing databases will already have the column after the first successful add.
    });

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

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "WorkItem_managerProfileId_workStatus_nextManagerUpdateAt_idx" ON "WorkItem"("managerProfileId", "workStatus", "nextManagerUpdateAt");`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "WorkItem_createdAt_idx" ON "WorkItem"("createdAt");`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "FollowUp_workItemId_status_dueAt_idx" ON "FollowUp"("workItemId", "status", "dueAt");`,
    );
  })();

  return bootstrapPromise;
}
