# Practice Planner

Builds timed practice plans from a tagged drill library, in the same format as Coach Jake's Google Doc plans:

1. Bold header line ("Monday, April 20th, 2026, MSE Field 12 6-7:30pm")
2. A numbered outline: Team Warmups (with a rotating team leader and missing players), Play Catch, Dailies, Water Breaks, Circuits with one coach per station and player groups, pitcher/catcher side work, an end game, and Notes for next practice.

It starts with baseball and softball. The data model is sport-agnostic, so other sports can be added later.

## Features

- **Plan form**: date, start time, length, location, playing surface, team, age and level, attendance (from a roster or a player count), coaches present, available equipment, focus areas (pick several), notes, and options for intro, dailies, side work and end game.
- **Auto-fill**: picks drills that fit the age, surface, equipment, number of coaches and number of players.
  - Spreads drills across the selected focus areas and avoids drills from the team's last few plans.
  - Builds circuits sized to the number of coaches, keeps catchers in different groups, and pairs pitchers with catchers.
  - Fits everything to the exact practice length and warns about anything it couldn't cover.
- **Editor**: live preview next to the editor.
  - Drag to reorder, edit any text or time, swap a drill for another one that fits, add stations or blocks, regenerate.
  - "Use setup for next practice" copies the form into a new plan.
- **Drill library**: about 110 drills taken from the 2024–2026 plans, with their video links.
  - Search and filter by age, surface, type, coaches, focus and whether it has a video.
  - Videos play inline (YouTube, Shorts with start times, and Google Drive).
  - Add or edit drills with tags for age, level, focus, surface, required equipment, duration, coaches, player counts and multiple video links.
  - Drills marked **Needs review** (Guts, Caterpillar, Pepper, Flip and a few others) were named in the plans without written rules. Check or fill in their descriptions.
- **Teams**: roster with pitcher and catcher roles and an active flag.
- **Exports**: Print/PDF, .docx, and **Save to Google Drive** (creates a native Google Doc named like your existing ones, e.g. `2026 12U-Blue Softball Practice Plan 4.20.26`; saving again updates the same doc).

## Quick start

```bash
npm install
cp .env.example .env
npx prisma migrate dev     # creates prisma/dev.db and seeds sports, tags and drills
npm run dev                # http://localhost:3000
```

The seed can be re-run safely (`npm run db:seed`). It only adds drills that don't exist yet, so your edits are never overwritten.

## Google Drive setup (optional)

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API**.
2. Set up the **OAuth consent screen**:
   - User type "External"
   - Publishing status "Testing"
   - Add your Google account as a test user
3. Create an **OAuth client ID**:
   - Type "Web application"
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`, plus your production URL with the same path
4. Fill in `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   NEXTAUTH_SECRET=<any long random string>
   NEXTAUTH_URL=http://localhost:3000
   ```
5. **Folder access.** The default `drive.file` scope only lets the app write into folders it can see. To save straight into your existing plans folder, add `GOOGLE_DRIVE_SCOPE=drive` to `.env`. That's fine for a personal app in Testing mode. If the folder isn't reachable, the doc goes to My Drive and the app tells you.
6. In **Settings**, paste the folder link (the seed preselects your practice plans folder), then click **Connect Google Drive**.

## Hosting

- **Node host** (Render, Railway, Fly, a home server): `npm run build && npx prisma migrate deploy && npm start`. SQLite works if the disk is persistent.
- **Vercel or other serverless**: needs Postgres. In `prisma/schema.prisma` change `provider = "sqlite"` to `"postgresql"`, set `DATABASE_URL`, delete `prisma/migrations`, and run `npx prisma migrate dev --name init`.

## Tests

```bash
npm run typecheck
npm run lint
npm test            # unit tests: generator, groups, formatting, exports (with a mocked Drive API)
npm run build && npm run test:e2e   # Playwright: team → plan → swap → print → .docx, plus the drill library
```

E2E runs on a throwaway `prisma/e2e.db` that is recreated each run.

## Adding another sport

Nothing in the generator or UI is baseball-specific. To add a sport:

1. `prisma/seed/sports.ts`: add the sport with its own `tagGroup` and a `config`:
   - player roles (e.g. goalkeeper)
   - which roles to spread across groups
   - optional side-work pairing
   - block template minutes
   - labels ("Team Warmups", "Play Catch", …)
2. `prisma/seed/tags.ts`: add FOCUS/EQUIPMENT tags under that `tagGroup`. Age, level and surface tags are shared.
3. Add drills with `sports: ["<slug>"]`, then run `npm run db:seed`.

New tags can also be added from the Settings page.

## Project layout

```
prisma/schema.prisma          Sport, Tag, Drill, DrillVideo, Team, Player, Coach, Location, Setting, Plan
prisma/seed/                  sports, tags, and the starter drill library
src/lib/generator/            pure plan generator (filter, groups, timeline) + tests
src/lib/export/               shared outline model → HTML / .docx / Google Doc
src/app/                      pages, server actions, API routes (docx, drive, auth)
src/components/               PlanForm, PlanEditor, PlanDocument, DrillLibrary, DrillForm, TeamEditor
```
