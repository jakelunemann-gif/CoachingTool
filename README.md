# Practice Planner

Builds timed practice plans from a tagged drill library, in the same format as Coach Jake's Google Doc plans:

1. Bold header line ("Monday, April 20th, 2026, MSE Field 12 6-7:30pm")
2. A numbered outline: Team Warmups (with a rotating team leader and missing players), Play Catch, Dailies, Water Breaks, Circuits with one coach per station and player groups, pitcher/catcher side work, an end game, and Notes for next practice.

It starts with baseball and softball. The data model is sport-agnostic, so other sports can be added later.

## Features

- **Coach accounts**: every coach logs in with their own email and password. Teams, plans, saved coaches, saved locations, the Drive folder and the default sport belong to that coach, and other coaches can't see them.
- **Shared drill library with review**:
  - Everyone plans from the shared library.
  - A drill a coach adds is private to them right away and can be used in their plans. It also goes into the admin's review queue.
  - Admins approve it into the shared library, or reject it with a note. A rejected drill stays private to that coach, who can update it and resubmit it.
  - Only admins can edit shared library drills and add tags.
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

Open the app and click **Create an account**. The first account becomes the admin.

The seed can be re-run safely (`npm run db:seed`). It only adds drills that don't exist yet, so your edits are never overwritten.

## Accounts and admins

- **First account.** The first account created is an admin.
  - Upgrading an install from before accounts existed? The first account also takes over the teams, plans, coaches, locations and Drive folder already saved.
  - To create the admin from the command line instead, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (and optionally `SEED_ADMIN_NAME`), then run `npm run db:seed`.
- **More admins.** Admins can make other coaches admins on the **Admin** page. Emails listed in `ADMIN_EMAILS` (comma-separated) are admins as soon as they sign up.
- **Limit who can sign up.** Anyone who can reach the app can create an account. To limit that, set `SIGNUP_CODE` and give the code to your coaches.
- **Passwords.** Coaches change their password in **Settings**. There's no email reset yet.

Logins use the app's own session cookie, stored in the `UserSession` table. Connecting Google Drive is a separate sign-in that's only used for saving docs.

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
6. In **Settings**, paste the folder link, then click **Connect Google Drive**. Each coach sets their own folder. The first account gets the folder from before accounts existed.

## Hosting

- **Node host** (Render, Railway, Fly, a home server): `npm run build && npx prisma migrate deploy && npm start`. SQLite works if the disk is persistent.
- **Vercel or other serverless**: needs Postgres. In `prisma/schema.prisma` change `provider = "sqlite"` to `"postgresql"`, set `DATABASE_URL`, delete `prisma/migrations`, and run `npx prisma migrate dev --name init`.

## Tests

```bash
npm run typecheck
npm run lint
npm test
npm run build && npm run test:e2e
```

`npm test` runs the unit tests (generator, groups, formatting, password hashing, exports with a mocked Drive API). `npm run test:e2e` runs the Playwright tests (team → plan → swap → print → .docx, the drill library, custom practice length, logins, and private drills going through admin review).

E2E runs on a throwaway `prisma/e2e.db` that is recreated each run and seeded with an admin account. Each test signs up its own coach.

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
prisma/schema.prisma          User, UserSession, Sport, Tag, Drill, DrillVideo, Team, Player, Coach, Location, Setting, Plan
prisma/seed/                  sports, tags, and the starter drill library
src/lib/generator/            pure plan generator (filter, groups, timeline) + tests
src/lib/export/               shared outline model → HTML / .docx / Google Doc
src/lib/auth/                 coach logins (password hashing, sessions) and the Google sign-in for Drive
src/middleware.ts             sends logged-out visitors to /login
src/app/                      pages, server actions, API routes (docx, drive, auth)
src/components/               PlanForm, PlanEditor, PlanDocument, DrillLibrary, DrillForm, ReviewQueue, TeamEditor
```
