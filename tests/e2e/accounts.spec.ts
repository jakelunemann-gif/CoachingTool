import { expect, test, type Page } from "@playwright/test";
import { ADMIN, logIn, signUp } from "./helpers";

async function addDrill(page: Page, name: string) {
  await page.goto("/drills/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Short description").fill(`${name} description.`);
  await page.getByRole("button", { name: "Save drill" }).click();
  await page.waitForURL(/\/drills$/);
}

const card = (page: Page, name: string) => page.getByTestId("drill-card").filter({ hasText: name });

test("pages and exports need a login", async ({ page }) => {
  await page.goto("/plans");
  await expect(page).toHaveURL(/\/login\?next=%2Fplans$/);
  expect((await page.request.get("/api/plans/anything/docx")).status()).toBe(401);

  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByTestId("auth-error")).toHaveText("Wrong email or password.");
  await expect(page.getByLabel("Email")).toHaveValue(ADMIN.email);

  // Logging in returns to the page that was asked for.
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/plans$/);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/teams");
  await expect(page).toHaveURL(/\/login/);
});

test("an admin's private drill skips the review queue", async ({ page }) => {
  await logIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/drills/new");
  await page.getByLabel("Name", { exact: true }).fill("Admin Private Drill");
  await page.getByLabel("Add to the shared library").uncheck();
  await page.getByRole("button", { name: "Save drill" }).click();
  await page.waitForURL(/\/drills$/);
  await page.getByLabel("Search drills").fill("Admin Private Drill");
  await expect(card(page, "Admin Private Drill").getByTestId("private-badge")).toHaveText("Only you · Private");
  await page.goto("/admin");
  await expect(card(page, "Admin Private Drill")).toHaveCount(0);

  // It can still go into the library later.
  await page.goto("/drills");
  await page.getByLabel("Search drills").fill("Admin Private Drill");
  await card(page, "Admin Private Drill").getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Add to shared library" }).click();
  await page.waitForURL(/\/drills$/);
  await page.getByLabel("Search drills").fill("Admin Private Drill");
  await expect(card(page, "Admin Private Drill").getByTestId("private-badge")).toHaveCount(0);
});

test("teams and drills are private until an admin approves a drill", async ({ browser }) => {
  const coachA = await (await browser.newContext()).newPage();
  const coachB = await (await browser.newContext()).newPage();
  const admin = await (await browser.newContext()).newPage();

  // Coach A saves a team and adds two drills, which wait for review.
  await signUp(coachA, "Coach Avery");
  await coachA.goto("/teams");
  await coachA.getByLabel("Team name").fill("Avery Sluggers");
  await coachA.locator('[data-chip="age:12u"]').click();
  await coachA.getByRole("button", { name: "Save team" }).click();
  await expect(coachA.getByRole("link", { name: /Avery Sluggers/ })).toBeVisible();
  const teamUrl = await coachA.getByRole("link", { name: /Avery Sluggers/ }).getAttribute("href");
  await addDrill(coachA, "Secret Sauce Relay");
  await addDrill(coachA, "Bucket Juggle");
  await coachA.getByLabel("Search drills").fill("Secret Sauce");
  await expect(card(coachA, "Secret Sauce Relay").getByTestId("private-badge")).toHaveText("Only you · Waiting for review");
  await expect(card(coachA, "Secret Sauce Relay").getByRole("link", { name: "Edit" })).toBeVisible();
  // Coaches can't edit library drills.
  await coachA.getByLabel("Search drills").fill("short hops");
  await expect(card(coachA, "Short Hops 5-5-5").getByRole("link", { name: "Edit" })).toHaveCount(0);

  // Coach B sees none of it and can't reach the admin page.
  await signUp(coachB, "Coach Blake");
  await coachB.goto("/teams");
  await expect(coachB.getByRole("link", { name: /Avery Sluggers/ })).toHaveCount(0);
  expect((await coachB.goto(teamUrl!))?.status()).toBe(404);
  await coachB.goto("/drills");
  await coachB.getByLabel("Search drills").fill("Secret Sauce");
  await expect(coachB.getByTestId("drill-card")).toHaveCount(0);
  await coachB.goto("/admin");
  await expect(coachB).toHaveURL(/\/$/);

  // The admin approves one drill and rejects the other with a note.
  await logIn(admin, ADMIN.email, ADMIN.password);
  await expect(admin.getByTestId("review-count")).toBeVisible();
  await admin.goto("/admin");
  await card(admin, "Secret Sauce Relay").getByRole("button", { name: "Approve" }).click();
  await expect(card(admin, "Secret Sauce Relay")).toHaveCount(0);
  await card(admin, "Bucket Juggle").getByRole("button", { name: "Reject…" }).click();
  await card(admin, "Bucket Juggle").getByLabel("Reason").fill("We already have Bucket Drill");
  await card(admin, "Bucket Juggle").getByRole("button", { name: "Reject", exact: true }).click();
  await expect(card(admin, "Bucket Juggle")).toHaveCount(0);

  // Coach B now has the approved drill in the shared library, read-only.
  await coachB.goto("/drills");
  await coachB.getByLabel("Search drills").fill("Secret Sauce");
  await expect(card(coachB, "Secret Sauce Relay")).toContainText("Shared by Coach Avery");
  await expect(card(coachB, "Secret Sauce Relay").getByRole("link", { name: "Edit" })).toHaveCount(0);
  await coachB.getByLabel("Search drills").fill("Bucket Juggle");
  await expect(coachB.getByTestId("drill-card")).toHaveCount(0);

  // Coach A keeps the rejected drill privately and sees why.
  await coachA.goto("/drills");
  await coachA.getByLabel("Search drills").fill("Bucket Juggle");
  await expect(card(coachA, "Bucket Juggle").getByTestId("private-badge")).toHaveText("Only you · Not added to library");
  await card(coachA, "Bucket Juggle").getByRole("link", { name: "Edit" }).click();
  await expect(coachA.getByText("We already have Bucket Drill")).toBeVisible();
  await coachA.getByRole("button", { name: "Resubmit for review" }).click();
  await expect(coachA.getByText("waiting for an admin to review it")).toBeVisible();
});
