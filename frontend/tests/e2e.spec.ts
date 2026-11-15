import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const SHARED_WORKSPACE_ID = `e2e_workspace_${Date.now()}`;

test.describe("OpenDataLens End-to-End Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript((wsId) => {
      window.localStorage.setItem("opendatalens_workspace_id", wsId);
      window.localStorage.setItem("opendatalens_tour_seen", "true");
    }, SHARED_WORKSPACE_ID);
  });
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
    await expect(page.getByText("Dataset Discovery").first()).toBeVisible();
    await expect(page.getByText("Quality Intelligence").first()).toBeVisible();
    await expect(page.getByText("Leak-Free ML Studio").first()).toBeVisible();
    await expect(page.getByText("Leaderboard & Scoreboard").first()).toBeVisible();
  });

  test("2. Dataset Explorer loads curated dataset into active memory and displays multi-format dropzone", async ({ page }) => {
    await page.goto("/explorer");
    await expect(page.getByRole("heading", { name: "Dataset Discovery" })).toBeVisible();

    // Verify Multi-format Upload Tab and Drag-and-Drop Zone
    const uploadTab = page.getByRole("button", { name: /Upload File/i });
    await uploadTab.click();
    await expect(page.getByText(/Drag & Drop or Upload Dataset/i)).toBeVisible();
    await expect(page.getByText(".xlsx, .xls")).toBeVisible();
    await expect(page.getByText(".json, .jsonl")).toBeVisible();
    await expect(page.getByText(".pdf")).toBeVisible();
    await expect(page.getByText(".sql")).toBeVisible();

    // Switch back to Curated tab, wait for curated dataset card and click Mount/Reload
    const curatedTab = page.getByRole("button", { name: /Curated Benchmarks/i });
    await curatedTab.click();
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

  test("7. Reports page provides direct download endpoints, saved projects, and share modal", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Analytics Reports & Export Depot" })).toBeVisible({ timeout: 10000 });

    // Verify primary export cards
    await expect(page.getByText("Executive PDF Report (.pdf)")).toBeVisible();
    await expect(page.getByText("Executive Excel Dossier (.xlsx)")).toBeVisible();
    await expect(page.getByText("Cleaned Dataset (.csv)")).toBeVisible();
    await expect(page.getByText("Interactive HTML Dossier")).toBeVisible();
    await expect(page.getByText("Machine-Readable JSON (.json)")).toBeVisible();
    await expect(page.getByText("GitHub README Summary (.md)")).toBeVisible();

    // Verify Action Toolbar buttons
    await expect(page.getByRole("button", { name: "Preview Report" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Project" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Saved Projects/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share Analysis" })).toBeVisible();

    // Open and verify Preview Modal
    await page.getByRole("button", { name: "Preview Report" }).click();
    await expect(page.getByText("Interactive Report Preview")).toBeVisible();
    await page.locator(".fixed").locator("button").filter({ has: page.locator("svg.lucide-x") }).first().click();

    // Open and verify Share Modal
    await page.getByRole("button", { name: "Share Analysis" }).click();
    await expect(page.getByText("Share Report Link")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate Secure Link" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
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

  test("9. Visual Analytics Studio renders histogram, correlation heatmap, and chart controls", async ({ page }) => {
    await page.goto("/visualize");
    await expect(page.getByRole("heading", { name: /Interactive Multi-Chart Studio/i })).toBeVisible({ timeout: 10000 });

    // Verify chart architecture options
    await expect(page.getByRole("button", { name: "Bar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Histogram", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Heatmap", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Donut", exact: true })).toBeVisible();

    // Switch to Histogram
    await page.getByRole("button", { name: "Histogram", exact: true }).click();
    await expect(page.getByText(/Distribution Histogram:/i)).toBeVisible({ timeout: 10000 });

    // Switch to Heatmap
    await page.getByRole("button", { name: "Heatmap", exact: true }).click();
    await expect(page.getByText(/Pairwise Feature Correlation Heatmap/i)).toBeVisible({ timeout: 10000 });

    // Verify Export buttons
    await expect(page.getByRole("button", { name: "PNG", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG", exact: true })).toBeVisible();
  });

  test("10. Data Quality Studio supports Sort, Normalize, Outliers, and Checkpoints", async ({ page }) => {
    await page.goto("/quality");
    await expect(page.getByRole("heading", { name: /Data Quality Intelligence/i })).toBeVisible({ timeout: 10000 });

    // Verify Tool Selector Pills
    await expect(page.getByRole("button", { name: "Sort Rows", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Normalize", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Outliers", exact: true })).toBeVisible();

    // Click Normalize
    await page.getByRole("button", { name: "Normalize", exact: true }).click();
    await expect(page.getByText("Normalize / Standardize Numeric Feature")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview Normalization" })).toBeVisible();

    // Click Sort Rows
    await page.getByRole("button", { name: "Sort Rows", exact: true }).click();
    await expect(page.getByText("Sort Dataset Rows Deterministically")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview Sort" })).toBeVisible();

    // Verify Save Checkpoint button in header
    await expect(page.getByTitle("Save current state as a named checkpoint")).toBeVisible();
  });

  test("11. AI Data Analyst Copilot widget opens, displays telemetry status, and supports conversation", async ({ page }) => {
    await page.goto("/dashboard");

    // Click floating trigger button
    const trigger = page.getByRole("button", { name: "Toggle AI Analyst Copilot" });
    await expect(trigger).toBeVisible();
    await trigger.click({ force: true });

    // Verify Copilot drawer opened
    await expect(page.getByText("AI Data Analyst")).toBeVisible();
    await expect(page.getByText("Agent Active")).toBeVisible();

    // Verify Privacy & Model Settings toggle
    const settingsBtn = page.getByTitle("Privacy & AI Provider Settings");
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    await expect(page.getByText("Privacy & Model Settings")).toBeVisible();
    await expect(page.getByText("Share 3 Sample Rows with AI")).toBeVisible();

    // Close settings subpanel
    await settingsBtn.click();

    // Click suggested prompt chip
    const promptChip = page.getByRole("button", { name: "Explain this dataset in simple words" });
    await expect(promptChip).toBeVisible();
    await promptChip.click();

    // Expect assistant response message
    await expect(page.getByText(/Dataset Overview:/i)).toBeVisible({ timeout: 15000 });
  });
});
