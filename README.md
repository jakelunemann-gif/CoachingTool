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

Run these from the folder that contains `package.json`, one line at a time:

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

`npx prisma migrate dev` creates `prisma/dev.db` and loads the sports, tags and drills. `npm run dev` starts the app at http://localhost:3000.

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

### Render (recommended)

The repo includes a `Dockerfile` and a `render.yaml` Blueprint, so Render sets up the web service, its persistent disk and most variables for you. SQLite lives on the disk. Starter plan (about $7/month) plus about $0.25/month for the 1 GB disk; the free plan can't attach a disk, so data would be wiped on every deploy.

1. Sign in at [render.com](https://render.com) with GitHub and give Render access to this repo.
2. Click **New → Blueprint**, pick this repo and the branch to deploy from (normally `main`).
3. Render reads `render.yaml` and asks for `APP_PASSWORD`. Enter the password you'll share with your coaches; don't reuse one you use anywhere else. `NEXTAUTH_SECRET` is generated for you, and `DATABASE_URL` points at the disk.
4. Click **Apply**. The first build takes a few minutes. Your URL looks like `https://practice-planner.onrender.com` (shown at the top of the service page).
5. Every start applies migrations and seeds the drill library (existing drills and edits are kept). Every push to the deploy branch redeploys automatically.

Open the URL. The browser asks for a username and password: type anything as the username and `APP_PASSWORD` as the password.

**Google Drive on the hosted app:** in the service's **Environment** tab, add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (and `GOOGLE_DRIVE_SCOPE=drive` if you use it). In the Google Cloud Console, add `<your URL>/api/auth/callback/google` as an authorized redirect URI. `NEXTAUTH_URL` defaults to the Render URL; set it only if you add a custom domain.

**Backups:** the whole database is `/var/data/app.db` on the disk. Render takes daily snapshots of disks, which you can restore from the service's **Disks** page.

### Other hosts

- **Any Docker host** (Fly, a home server): build the `Dockerfile`, mount a persistent disk, and set the same variables. The container listens on `$PORT` (default 3000).
- **Vercel or other serverless**: needs Postgres. In `prisma/schema.prisma` change `provider = "sqlite"` to `"postgresql"`, set `DATABASE_URL`, delete `prisma/migrations`, and run `npx prisma migrate dev --name init`.

Leave `APP_PASSWORD` unset only if you're fine with anyone who finds the URL viewing and editing your rosters and plans.

## Tests

```bash
npm run typecheck
npm run lint
npm test
npm run build && npm run test:e2e
```

`npm test` runs the unit tests (generator, groups, formatting, exports with a mocked Drive API). `npm run test:e2e` runs the Playwright tests (team → plan → swap → print → .docx, the drill library, and custom practice length).

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
