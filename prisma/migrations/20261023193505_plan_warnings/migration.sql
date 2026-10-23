-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "teamId" TEXT,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "teamLeader" TEXT NOT NULL DEFAULT '',
    "seed" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "showTimes" BOOLEAN NOT NULL DEFAULT true,
    "warnings" JSONB NOT NULL DEFAULT [],
    "driveFileId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Plan_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Plan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Plan" ("createdAt", "date", "driveFileId", "durationMin", "id", "input", "items", "location", "seed", "showTimes", "sportId", "startTime", "teamId", "teamLeader", "title", "updatedAt") SELECT "createdAt", "date", "driveFileId", "durationMin", "id", "input", "items", "location", "seed", "showTimes", "sportId", "startTime", "teamId", "teamLeader", "title", "updatedAt" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
