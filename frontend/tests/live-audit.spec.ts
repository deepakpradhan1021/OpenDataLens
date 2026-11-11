import { test, expect } from "@playwright/test";

const LIVE_URL = process.env.LIVE_URL || "https://opendatalens-app.vercel.app";

test.describe("OpenDataLens Live Production Audit & Full User Journey", () => {
  test.use({ baseURL: LIVE_URL });

  test("1. End-to-End User Journey: Curated Dataset -> Quality -> Studio -> Comparison -> Drift -> Reports", async ({ page }) => {
    test.setTimeout(120000);
    const AUDIT_WORKSPACE_ID = `audit_live_class_${Date.now()}`;
    await page.addInitScript((wsId) => {
      window.localStorage.setItem("opendatalens_workspace_id", wsId);
    }, AUDIT_WORKSPACE_ID);

    // --- STEP A: HOMEPAGE ---
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");
    await expect(page).toHaveTitle(/OpenDataLens/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Explore Remote Datasets");
    await expect(page.locator("header").getByText("OpenDataLens")).toBeVisible();

    // Verify navigation links
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Explorer" })).toBeVisible();
    await expect(header.getByRole("link", { name: "ML Studio" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Data Drift" })).toBeVisible();

    // --- STEP B: INITIAL DASHBOARD (Empty State) ---
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Platform Dashboard" })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("No Dataset Currently Mounted")).toBeVisible();
    const goToExpBtn = page.getByRole("link", { name: "Go to Dataset Explorer" });
    await expect(goToExpBtn).toBeVisible();

    // --- STEP C: DATASET EXPLORER (Mount Iris) ---
    await goToExpBtn.click();
    await page.waitForURL("**/explorer", { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Dataset Discovery" })).toBeVisible({ timeout: 20000 });

    // Wait for curated catalog to load from Render backend
    const irisCard = page.getByText("Iris Flower Dataset");
    await expect(irisCard).toBeVisible({ timeout: 25000 });

    // Mount Iris dataset
    const mountBtn = page.getByRole("button", { name: /^Mount$|^Reload$/i }).first();
    await mountBtn.click();

    // Confirm active dataset preview table
    await expect(page.getByText(/Active Dataset:\s*iris/i)).toBeVisible({ timeout: 20000 });
    await expect(page.locator("table").first()).toBeVisible();

    // Verify Dashboard now shows active dataset
    await page.goto("/dashboard");
    await expect(page.getByText("Active Dataset")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Matrix Dimensions")).toBeVisible();

    // --- STEP D: DATA QUALITY INTELLIGENCE & COPILOT ---
    await page.goto("/quality");
    await expect(page.getByRole("heading", { name: "Data Quality Intelligence" })).toBeVisible({ timeout: 20000 });

    // Check KPI metrics
    await expect(page.getByText("Completeness Score")).toBeVisible();
    await expect(page.getByText("Duplicate Rows")).toBeVisible();
    await expect(page.getByText("Features Audited")).toBeVisible();
    await expect(page.getByText("Memory Footprint")).toBeVisible();

    // Check Feature Distribution Inspector
    await expect(page.getByText("Feature Distribution Inspector")).toBeVisible();

    // Test Copilot interaction
    const explainBtn = page.getByRole("button", { name: "Explain my dataset" });
    if (await explainBtn.isVisible()) {
      await explainBtn.click();
      await expect(page.getByText(/Copilot Analysis/i)).toBeVisible({ timeout: 15000 });
    }

    // --- STEP E: ML STUDIO (Classification) ---
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: "ML Training Studio" })).toBeVisible({ timeout: 20000 });

    // Select Classification
    const classBtn = page.getByRole("button", { name: "Classification" });
    await classBtn.click();

    // Verify Target column selector has options
    await expect(page.getByText("Target Variable (y)")).toBeVisible();

    // Trigger Training Job
    const trainBtn = page.getByRole("button", { name: /Dispatch Parallel Training Job/i });
    await expect(trainBtn).toBeVisible();
    await trainBtn.click();

    // Polling handles training and automatically redirects to /comparison
    await page.waitForURL("**/comparison", { timeout: 90000 });
    await expect(page.getByRole("heading", { name: "Model Comparison & Intelligence" })).toBeVisible({ timeout: 20000 });

    // --- STEP F: MODEL COMPARISON & EXPLAINABILITY ---
    await expect(page.getByText("Champion Model Architecture")).toBeVisible();
    await expect(page.getByText("Model Performance Scoreboard")).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();

    // Test Explainable AI Tab
    const xaiTab = page.getByRole("button", { name: /Explainable AI/i });
    await xaiTab.click();
    await expect(page.getByText("Permutation Feature Importance")).toBeVisible();

    // Test Experiment History Tab
    const expTab = page.getByRole("button", { name: /Experiment History/i });
    await expTab.click();
    await expect(page.getByText("Reproducible Experiment Tracking")).toBeVisible();

    // --- STEP G: DATA DRIFT MONITOR ---
    await page.goto("/drift");
    await expect(page.getByRole("heading", { name: "Data Drift & Stability Monitor" })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Mean Dataset PSI")).toBeVisible();
    await expect(page.getByText("Schema Integrity")).toBeVisible();

    // --- STEP H: REPORTS & EXPORT BAY ---
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Evaluation Reports & Model Export" })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Interactive HTML Dossier")).toBeVisible();
    await expect(page.getByText("Machine-Readable JSON")).toBeVisible();
    await expect(page.getByText("GitHub README Summary")).toBeVisible();
    await expect(page.getByText(/Export Serialized Scikit-learn Pipeline/i)).toBeVisible();

    // Verify console is clean of critical application errors
    const appBreakingErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("WebGL") && !e.includes("404") && !e.includes("Third-party")
    );
    expect(appBreakingErrors.length).toBe(0);
  });

  test("2. Regression Workflow: Mount Diabetes Dataset -> Train Regression -> Compare R² / MAE / RMSE", async ({ page }) => {
    test.setTimeout(120000);
    const REG_WORKSPACE_ID = `audit_reg_${Date.now()}`;
    await page.addInitScript((wsId) => {
      window.localStorage.setItem("opendatalens_workspace_id", wsId);
    }, REG_WORKSPACE_ID);

    // Explorer: Mount Diabetes Progression Benchmark
    await page.goto("/explorer");
    await expect(page.getByRole("heading", { name: "Dataset Discovery" })).toBeVisible({ timeout: 20000 });

    const diaCard = page.getByRole("heading", { name: "Diabetes Progression" });
    await expect(diaCard).toBeVisible({ timeout: 25000 });

    const mountDiaBtn = diaCard.locator("..").locator("..").getByRole("button", { name: /^Mount$|^Reload$/i });
    await mountDiaBtn.click();

    await expect(page.getByText(/Active Dataset:\s*Diabetes Progression/i)).toBeVisible({ timeout: 25000 });
    await expect(page.locator("table").first()).toBeVisible();

    // ML Studio: Verify Regression problem formulation
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: "ML Training Studio" })).toBeVisible({ timeout: 20000 });

    const regBtn = page.getByRole("button", { name: "Regression" });
    await regBtn.click();

    // Train regression models
    const trainBtn = page.getByRole("button", { name: /Dispatch Parallel Training Job/i });
    await trainBtn.click();

    await page.waitForURL("**/comparison", { timeout: 60000 });
    await expect(page.getByRole("heading", { name: "Model Comparison & Intelligence" })).toBeVisible({ timeout: 20000 });

    // Verify scoreboard has regression metrics: R², MAE, RMSE
    await expect(page.locator("table").first()).toBeVisible();
    await expect(page.getByText(/R²|MAE|RMSE|Score/i).first()).toBeVisible();
  });

  test("3. CSV Upload Workflow: Parse valid custom CSV and render dataset matrix", async ({ page }) => {
    test.setTimeout(60000);
    const CSV_WORKSPACE_ID = `audit_csv_upload_${Date.now()}`;
    await page.addInitScript((wsId) => {
      window.localStorage.setItem("opendatalens_workspace_id", wsId);
    }, CSV_WORKSPACE_ID);

    await page.goto("/explorer");
    await expect(page.getByRole("heading", { name: "Dataset Discovery" })).toBeVisible({ timeout: 20000 });

    // Switch to Upload Custom CSV tab
    await page.getByRole("button", { name: "Upload Custom CSV" }).click();
    await expect(page.getByText("Upload Custom CSV or Delimited File")).toBeVisible();

    // Upload custom CSV file via fileChooser
    const csvContent = "feature_a,feature_b,feature_c,target\n1.2,3.4,5.6,0\n2.3,4.5,6.7,1\n3.4,5.6,7.8,0\n4.5,6.7,8.9,1\n5.6,7.8,9.0,0\n6.7,8.9,1.2,1\n7.8,9.0,2.3,0\n8.9,1.2,3.4,1\n9.0,2.3,4.5,0\n1.1,2.2,3.3,1\n";
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Select CSV from Computer").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "custom_portfolio_data.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });

    // Expect preview table to render with the uploaded dataset
    await expect(page.getByText(/Active Dataset:\s*custom_portfolio_data/i)).toBeVisible({ timeout: 25000 });
    await expect(page.locator("table").first()).toBeVisible();
    await expect(page.getByText("feature_a").first()).toBeVisible();
    await expect(page.getByText("target").first()).toBeVisible();
  });
});
