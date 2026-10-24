import { expect, type Page } from "@playwright/test";

// Seeded by global-setup.ts through SEED_ADMIN_* (see playwright.config.ts).
export const ADMIN = { email: "admin@example.com", password: "admin-password" };

let counter = 0;

/** Signs up a brand-new coach so every test starts with its own empty account. */
export async function signUp(page: Page, name = "Test Coach") {
  const email = `coach-${Date.now()}-${process.pid}-${counter++}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("practice-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByTestId("signed-in-as")).toHaveText(name);
  return email;
}

export async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByTestId("signed-in-as")).toBeVisible();
}
