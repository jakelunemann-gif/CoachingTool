import { execSync } from "child_process";
import { rmSync } from "fs";
import path from "path";
import { ADMIN } from "./helpers";

// Fresh throwaway database for every run: delete the e2e file, apply the
// migrations and seed it with an admin account. Never touches dev.db.
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: "file:./e2e.db", SEED_ADMIN_EMAIL: ADMIN.email, SEED_ADMIN_PASSWORD: ADMIN.password, SEED_ADMIN_NAME: "Head Admin" };
  for (const suffix of ["", "-journal"]) rmSync(path.join(__dirname, "../../prisma", `e2e.db${suffix}`), { force: true });
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx prisma db seed", { stdio: "inherit", env });
}
