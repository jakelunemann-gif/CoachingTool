-- CreateTable
CREATE TABLE "PlanDrill" (
    "planId" TEXT NOT NULL,
    "drillId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("planId", "drillId"),
    CONSTRAINT "PlanDrill_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanDrill_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "Drill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DrillRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drillId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrillRating_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "Drill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrillRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlanDrill_drillId_idx" ON "PlanDrill"("drillId");

-- CreateIndex
CREATE UNIQUE INDEX "DrillRating_drillId_userId_key" ON "DrillRating"("drillId", "userId");

-- Backfill from the drill ids already stored in each plan's items tree,
-- skipping drills that have since been deleted.
INSERT INTO "PlanDrill" ("planId", "drillId", "count")
SELECT p."id", j."value", COUNT(*)
FROM "Plan" p, json_tree(p."items") j
WHERE j."key" = 'drillId' AND j."value" IN (SELECT "id" FROM "Drill")
GROUP BY p."id", j."value";
