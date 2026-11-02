import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { signUp } from "./helpers";

test("team → plan → edit → export", async ({ page }) => {
  await signUp(page);
  // Create a team with a roster.
  await page.goto("/teams");
  await page.getByLabel("Team name").fill("12U-Blue");
  await page.locator('[data-chip="age:12u"]').click();
  await page.locator('[data-chip="skill:a"]').click();
  await page.getByLabel("Add players").fill("Aura\nNoreen\nAvery V\nPiper\nOlivia\nMarin\nVeda\nAudrey\nVivian\nAvarie\nSophia");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByTestId("roster-row")).toHaveCount(11);
  await page.getByLabel("Aura Catcher").check();
  await page.getByLabel("Noreen Catcher").check();
  await page.getByLabel("Piper Pitcher").check();
  await page.getByLabel("Olivia Pitcher").check();
  await page.getByRole("button", { name: "Save team" }).click();
  await expect(page.getByRole("link", { name: /12U-Blue/ })).toBeVisible();

  // Build a gym practice: 3 coaches, hitting + bunting, 90 minutes.
  await page.goto("/plans/new");
  await page.getByLabel("Saved team").selectOption({ label: "12U-Blue" });
  await page.getByLabel("Date").fill("2026-04-13");
  await page.getByLabel("Start time").fill("20:00");
  await page.getByLabel("Location").fill("MSE Gym 3");
  await page.locator('[data-chip="surface:gym"]').click();
  await page.locator('[data-chip="player:Vivian"]').click(); // missing
  // Picking a saved team hides the duplicate team name field.
  await expect(page.getByLabel("Team name")).toHaveCount(0);
  // The signed-in coach starts selected; turn them off so this practice has three coaches.
  const self = page.locator('[data-chip="coach:Test Coach"]');
  await expect(self).toHaveAttribute("aria-pressed", "true");
  await expect(self).toHaveText("Test Coach (you)");
  await self.click();
  for (const c of ["Jake", "Trevor", "Brandon"]) {
    await page.getByLabel("Add coach").fill(c);
    await page.getByLabel("Add coach").press("Enter");
  }
  // Typing an existing coach another way doesn't add a duplicate.
  await page.getByLabel("Add coach").fill("coach jake");
  await page.getByLabel("Add coach").press("Enter");
  await expect(page.locator('[data-chip^="coach:"][aria-pressed="true"]')).toHaveCount(3);
  await page.locator('[data-chip="focus:hitting-mechanics"]').click();
  await page.locator('[data-chip="focus:bunting"]').click();
  await page.getByLabel("Notes for next practice").fill("Wednesday at MSE Gym 2 CAGES");
  await page.getByRole("button", { name: "Build practice plan" }).click();

  await page.waitForURL(/\/plans\/[^/]+$/);
  const doc = page.getByTestId("plan-document");
  await expect(doc).toContainText("Monday, April 13th, 2026, MSE Gym 3 8-9:30pm");
  await expect(doc).toContainText("Team Warmups");
  await expect(doc).toContainText("Missing: Vivian");
  await expect(doc).toContainText("Water Break");
  await expect(doc).toContainText("-Coach Jake");
  await expect(doc).toContainText("Wednesday at MSE Gym 2 CAGES");
  await expect(page.getByTestId("time-total")).toHaveText("90 / 90 min");
  await expect(page.getByTestId("station").first()).toBeVisible();

  // Swap the first station drill.
  const firstStation = page.getByTestId("station").first();
  const before = await firstStation.getByLabel("Station title").inputValue();
  await firstStation.getByRole("button", { name: "Swap" }).click();
  const dialog = page.getByRole("dialog", { name: "Pick a drill" });
  await dialog.locator("li button").first().click();
  await expect(firstStation.getByLabel("Station title")).not.toHaveValue(before);

  await page.getByRole("button", { name: "Save*" }).click();
  await expect(page.getByTestId("editor-message")).toHaveText("Saved");

  // Exports sit in one menu; Drive is hidden until Google sign-in is set up.
  await page.getByRole("button", { name: "Export ▾" }).click();
  await expect(page.getByRole("menuitem", { name: "Print / PDF" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Download .docx" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Google/ })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Print / PDF" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Download .docx" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Export ▾" })).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Use setup for next practice" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete plan" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Print view.
  const url = page.url();
  await page.goto(`${url}/print`);
  await expect(page.getByTestId("plan-document")).toContainText("Practice Plan");
  await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();

  // .docx download parses and has the header.
  const res = await page.request.get(`${url.replace(/\/plans\//, "/api/plans/")}/docx`);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-disposition"]).toContain("2026 12U-Blue Softball Practice Plan 4.13.26.docx");
  const zip = await JSZip.loadAsync(await res.body());
  expect(await zip.file("word/document.xml")!.async("string")).toContain("MSE Gym 3");

  // Drive export explains setup when Google isn't configured.
  const drive = await page.request.post(`${url.replace(/\/plans\//, "/api/plans/")}/drive`);
  expect(drive.status()).toBe(400);
  expect((await drive.json()).error).toContain("GOOGLE_CLIENT_ID");
});

test("drill library filters and editing", async ({ page }) => {
  await signUp(page);
  await page.goto("/drills");
  await expect(page.getByTestId("drill-card").first()).toBeVisible();
  await page.getByLabel("Search drills").fill("short hops");
  await expect(page.getByTestId("drill-card")).toHaveCount(1);
  await expect(page.getByTestId("drill-card")).toContainText("Short Hops 5-5-5");
  await expect(page.getByRole("link", { name: /Short hops ↗/ })).toHaveAttribute("href", "https://youtube.com/shorts/Grh5LzxZ2WM");

  await page.goto("/drills/new");
  await page.getByLabel("Name", { exact: true }).fill("Pickoff Moves");
  await page.getByLabel("Short description").fill("Catcher pickoffs to first and third.");
  await page.locator('[data-chip="focus:"]').first().waitFor({ state: "detached" }).catch(() => {});
  await page.getByRole("group", { name: "focus" }).getByRole("button", { name: "Catching" }).click();
  await page.getByLabel("Video URL").fill("https://youtu.be/abc123");
  await page.getByRole("button", { name: "Save drill" }).click();
  await page.waitForURL(/\/drills$/);
  await page.getByLabel("Search drills").fill("pickoff");
  await expect(page.getByTestId("drill-card")).toHaveCount(1);
});

test("custom practice length", async ({ page }) => {
  await signUp(page);
  await page.goto("/plans/new");
  await expect(page.getByLabel("Custom minutes")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "90 min" })).toBeChecked();
  const custom = page.getByRole("radio", { name: "Custom" });
  await custom.check();
  const minutes = page.getByLabel("Custom minutes");
  await expect(minutes).toBeFocused();
  await expect(custom).toBeChecked();
  // Typing a preset value stays in custom mode instead of snapping back.
  await minutes.fill("90");
  await expect(custom).toBeChecked();
  await expect(page.getByRole("radio", { name: "90 min" })).not.toBeChecked();
  await minutes.fill("50");
  await page.getByLabel("Start time").fill("20:00");
  await page.locator('[data-chip="age:10u"]').click();
  await page.getByRole("button", { name: "Build practice plan" }).click();
  await page.waitForURL(/\/plans\/[^/]+$/);
  await expect(page.getByTestId("plan-document")).toContainText("8-8:50pm");
  await expect(page.getByTestId("time-total")).toHaveText("50 / 50 min");

  // Switching back to a preset hides the box and uses the preset.
  await page.goto("/plans/new");
  await page.getByRole("radio", { name: "Custom" }).check();
  await page.getByRole("radio", { name: "60 min" }).check();
  await expect(page.getByLabel("Custom minutes")).toHaveCount(0);
});

test("phone layout", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Coach Phone");
  await page.getByLabel("Email").fill(`phone-${Date.now()}-${process.pid}@example.com`);
  await page.getByLabel("Password").fill("practice-123");
  await page.getByRole("button", { name: "Create account" }).click();

  // A bottom tab bar replaces the wrapped top links; account links sit under the coach's name.
  const tabs = page.getByRole("navigation", { name: "Main" });
  await expect(tabs).toBeVisible();
  await expect(page.getByTestId("signed-in-as")).toBeHidden();
  await tabs.getByRole("link", { name: "New plan" }).click();
  await page.waitForURL(/\/plans\/new$/);
  await expect(tabs.getByRole("link", { name: "New plan" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Plans" })).not.toHaveAttribute("aria-current", "page");

  // The saved coach is "Phone", without the typed "Coach " prefix.
  await expect(page.locator('[data-chip="coach:Phone"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-chip="age:12u"]').click();
  await page.getByRole("button", { name: "Build practice plan" }).click();
  await page.waitForURL(/\/plans\/[^/]+$/);
  await expect(page.getByTestId("plan-document")).toBeVisible();

  // Block titles get their own row instead of being squeezed to a few letters.
  const title = page.getByLabel("Block title").first();
  expect((await title.boundingBox())!.width).toBeGreaterThan(220);

  await page.getByTestId("account-menu").click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.waitForURL(/\/settings$/);
  await expect(page.getByTestId("drive-unavailable")).toContainText("Ask your admin");
  await expect(page.getByText("GOOGLE_CLIENT_ID")).toHaveCount(0);

  // Tapping the page you're already on still closes the menu, and Log out works from it.
  await page.getByTestId("account-menu").click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByTestId("account-menu").click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL(/\/login/);
  await context.close();
});
