import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("OpenDataLens End-to-End Suite", () => {
  test("1. Landing Page renders branding, hero and navigation without fake badges", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/OpenDataLens/i);

    // Verify brand header
    const brand = page.locator("header").getByText("OpenDataLens");
    await expect(brand).toBeVisible();

    // Verify NO Awwwards badges or fake awards exist
    const awwwardsMentions = await page.getByText(/awwward/i).count();
    expect(awwwardsMentions).toBe(0);

    // Verify Hero title
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Explore Remote Datasets");

    // Verify Workflow Steps
    await expect(page.getByText("Dataset Discovery")).toBeVisible();
    await expect(page.getByText("Quality Intelligence")).toBeVisible();
    await expect(page.getByText("Leak-Free ML Studio")).toBeVisible();
    await expect(page.getByText("Leaderboard & Scoreboard")).toBeVisible();
  });

  test("2. Dataset Explorer loads curated dataset into active memory", async ({ page }) => {
    await page.goto("/explorer");
    await expect(page.getByRole("heading", { name: "Dataset Discovery" })).toBeVisible();

    // Wait for curated dataset card and click Mount/Reload
    const mountBtn = page.getByRole("button", { name: /Mount|Reload/i }).first();
    await expect(mountBtn).toBeVisible({ timeout: 10000 });
    await mountBtn.click();

    // Expect preview table to be visible with rows
    await expect(page.getByText(/Active Dataset:/i)).toBeVisible({ timeout: 10000 });
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("3. Data Quality Intelligence displays completeness and stats", async ({ page }) => {
    await page.goto("/quality");
    await expect(page.getByRole("heading", { name: /Data Quality Intelligence/i })).toBeVisible({ timeout: 10000 });

    // Verify completeness metric card
    await expect(page.getByText("Completeness Score")).toBeVisible();
    await expect(page.getByText("Duplicate Rows")).toBeVisible();
    await expect(page.getByText("Features Audited")).toBeVisible();
  });

  test("4. ML Studio configures and runs model training workflow", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: "ML Training Studio" })).toBeVisible({ timeout: 10000 });

    // Verify Problem Formulation
    await expect(page.getByRole("button", { name: "Classification" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Regression" })).toBeVisible();

    // Verify Start Training Button is enabled
    const trainBtn = page.getByRole("button", { name: /Start Training Run/i });
    await expect(trainBtn).toBeVisible();
    await trainBtn.click();

    // Wait for the background worker to finish and automatically route to /comparison
    await page.waitForURL("**/comparison", { timeout: 30000 });
    await expect(page.getByRole("heading", { name: /Model Comparison/i })).toBeVisible({ timeout: 10000 });
  });

  test("5. Model Comparison displays leaderboard, XAI, and diagnostics", async ({ page }) => {
    await page.goto("/comparison");
    await expect(page.getByRole("heading", { name: /Model Comparison/i })).toBeVisible({ timeout: 10000 });

    // Verify scoreboard table
    await expect(page.getByText(/Model Performance Scoreboard/i)).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();

    // Verify Explainable AI tab
    const xaiTab = page.getByRole("button", { name: /Explainable AI/i });
    await expect(xaiTab).toBeVisible();
    await xaiTab.click();
    await expect(page.getByText(/Permutation Feature Importance/i)).toBeVisible();

    // Verify Experiment History tab
    const expTab = page.getByRole("button", { name: /Experiment History/i });
    await expect(expTab).toBeVisible();
    await expTab.click();
    await expect(page.getByText(/Reproducible Experiment Tracking/i)).toBeVisible();
  });

  test("6. Data Drift page displays stability metrics and PSI score", async ({ page }) => {
    await page.goto("/drift");
    await expect(page.getByRole("heading", { name: /Data Drift & Stability Monitor/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Mean Dataset PSI")).toBeVisible();
    await expect(page.getByText("Schema Integrity")).toBeVisible();
  });

  test("7. Reports page provides direct download endpoints", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Evaluation Reports & Model Export" })).toBeVisible({ timeout: 10000 });

    // Verify report cards
    await expect(page.getByText("Interactive HTML Dossier")).toBeVisible();
    await expect(page.getByText("Machine-Readable JSON")).toBeVisible();
    await expect(page.getByText("GitHub README Summary")).toBeVisible();
    await expect(page.getByText(/Export Serialized Scikit-learn Pipeline/i)).toBeVisible();
  });

  test("8. Mobile responsive viewport test", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Verify brand
    await expect(page.locator("header").getByText("OpenDataLens")).toBeVisible();

    // Verify toggle menu button on mobile
    const toggleMenu = page.getByLabel("Toggle Menu");
    await expect(toggleMenu).toBeVisible();
    await toggleMenu.click();

    // Expect mobile navigation links in header
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Explorer", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "ML Studio", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Data Drift", exact: true })).toBeVisible();
  });
});
