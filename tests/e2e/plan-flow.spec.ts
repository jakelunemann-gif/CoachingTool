import { expect, test } from "@playwright/test";
import JSZip from "jszip";

test("team → plan → edit → export", async ({ page }) => {
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
  for (const c of ["Jake", "Trevor", "Brandon"]) {
    await page.getByLabel("Add coach").fill(c);
    await page.getByLabel("Add coach").press("Enter");
  }
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
  await page.goto("/plans/new");
  await expect(page.getByLabel("Custom minutes")).toHaveCount(0);
  await page.getByLabel("Length (minutes)").selectOption("custom");
  const minutes = page.getByLabel("Custom minutes");
  await expect(minutes).toBeFocused();
  await expect(page.getByLabel("Length (minutes)")).toHaveValue("custom");
  // Typing a preset value stays in custom mode instead of snapping back.
  await minutes.fill("90");
  await expect(page.getByLabel("Length (minutes)")).toHaveValue("custom");
  await minutes.fill("50");
  await page.getByLabel("Start time").fill("20:00");
  await page.locator('[data-chip="age:10u"]').click();
  await page.getByRole("button", { name: "Build practice plan" }).click();
  await page.waitForURL(/\/plans\/[^/]+$/);
  await expect(page.getByTestId("plan-document")).toContainText("8-8:50pm");
  await expect(page.getByTestId("time-total")).toHaveText("50 / 50 min");

  // Switching back to a preset hides the box and uses the preset.
  await page.goto("/plans/new");
  await page.getByLabel("Length (minutes)").selectOption("custom");
  await page.getByLabel("Length (minutes)").selectOption("60");
  await expect(page.getByLabel("Custom minutes")).toHaveCount(0);
});
