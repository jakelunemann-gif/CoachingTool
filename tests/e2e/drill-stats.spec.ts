import { expect, test } from "@playwright/test";
import { ADMIN, logIn, signUp } from "./helpers";

// Uses the coach's own private drill so other tests' plans, which run in
// parallel against the same database, can't change the counts.
test("admins see how often a drill is used and how coaches rate it", async ({ browser }) => {
  const coach = await (await browser.newContext()).newPage();
  await signUp(coach, "Rating Coach");
  const name = `Usage Drill ${Date.now()}`;
  const comment = "Kids loved it, keep the lines short.";

  // A private circuit-station drill.
  await coach.goto("/drills/new");
  await coach.getByLabel("Name", { exact: true }).fill(name);
  await coach.getByLabel("Short description").fill("Tracks usage in the admin panel.");
  await coach.getByRole("button", { name: "Save drill" }).click();
  await coach.waitForURL(/\/drills$/);

  // Rate it 4 stars with a comment; the rating survives a reload.
  await coach.getByLabel("Search drills").fill(name);
  const card = coach.getByTestId("drill-card").filter({ hasText: name });
  await expect(card.getByTestId("rating-summary")).toHaveText("No ratings yet");
  await card.getByRole("button", { name: "Rate 4 stars" }).click();
  await expect(card.getByTestId("rating-summary")).toHaveText("★ 4.0 · 1 rating");
  await card.getByRole("button", { name: "Add a comment" }).click();
  await card.getByLabel(`Comment on ${name}`).fill(comment);
  await card.getByRole("button", { name: "Save comment" }).click();
  await expect(card).toContainText(comment);
  await expect(card.getByRole("button", { name: "Rate 4 stars" })).toBeEnabled();
  await coach.reload();
  await coach.getByLabel("Search drills").fill(name);
  await expect(card.getByTestId("rating-summary")).toHaveText("★ 4.0 · 1 rating");
  await expect(card.getByRole("button", { name: "Rate 4 stars" })).toHaveAttribute("aria-pressed", "true");

  // Build a plan and swap the drill into the first station.
  await coach.goto("/plans/new");
  await coach.getByLabel("Date").fill("2026-05-04");
  await coach.getByLabel("Start time").fill("18:00");
  await coach.getByLabel("Location").fill("Usage Field");
  await coach.locator('[data-chip="age:12u"]').click();
  for (const c of ["Ana", "Ben"]) {
    await coach.getByLabel("Add coach").fill(c);
    await coach.getByLabel("Add coach").press("Enter");
  }
  await coach.getByRole("button", { name: "Build practice plan" }).click();
  await coach.waitForURL((url) => /^\/plans\/[^/]+$/.test(url.pathname) && url.pathname !== "/plans/new");
  const station = coach.getByTestId("station").first();
  await station.getByRole("button", { name: "Swap" }).click();
  const picker = coach.getByRole("dialog", { name: "Pick a drill" });
  await picker.getByLabel("show all").check();
  await picker.getByPlaceholder("Search drills…").fill(name);
  await picker.locator("li button").filter({ hasText: name }).click();
  await expect(station.getByLabel("Station title")).toHaveValue(name);
  await coach.getByRole("button", { name: "Save*" }).click();
  await expect(coach.getByTestId("editor-message")).toHaveText("Saved");

  // The admin sees one plan, one coach and the rating.
  const admin = await (await browser.newContext()).newPage();
  await logIn(admin, ADMIN.email, ADMIN.password);
  await admin.goto("/admin");
  const stats = admin.getByTestId("drill-stats");
  const row = stats.getByTestId("drill-stat-row").filter({ hasText: name });
  await admin.getByLabel("Search drill stats").fill(name);
  await expect(row).toHaveCount(0); // private drills are hidden by default
  await admin.getByLabel("Include coaches' private drills").check();
  await expect(row.getByTestId("stat-plans")).toHaveText("1");
  await expect(row.getByTestId("stat-coaches")).toHaveText("1");
  await expect(row.getByTestId("stat-rating")).toHaveText("★ 4.0 (1)");
  await expect(admin.getByTestId("rating-comments")).toContainText(comment);
  await expect(admin.getByTestId("rating-comments")).toContainText("Rating Coach");

  // Deleting the plan takes it off the count.
  coach.on("dialog", (d) => d.accept());
  await coach.getByRole("button", { name: "More actions" }).click();
  await coach.getByRole("menuitem", { name: "Delete plan" }).click();
  await coach.waitForURL(/\/plans$/);
  await admin.reload();
  await admin.getByLabel("Search drill stats").fill(name);
  await admin.getByLabel("Include coaches' private drills").check();
  await expect(row.getByTestId("stat-plans")).toHaveText("0");
  await expect(row).toContainText("Never");
});
