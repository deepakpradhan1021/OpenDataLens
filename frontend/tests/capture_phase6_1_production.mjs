import { chromium, devices } from "playwright";
import path from "path";
import fs from "fs";

const OUT_DIR = "C:/Users/deepa/.gemini/antigravity/brain/e1b46517-96f3-49ca-9124-efcfc559bd1d/screenshots";
const LIVE_URL = "https://opendatalens-app.vercel.app";

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log("=== Launching Playwright against LIVE Production: " + LIVE_URL + " ===");
  const browser = await chromium.launch();

  // Desktop Context (1440x900)
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const sessionPrefix = `live_p61_${Date.now()}`;

  await context.addInitScript((sId) => {
    window.localStorage.setItem("opendatalens_tour_seen", "true");
    window.localStorage.setItem("opendatalens_workspace_id", sId);
    window.localStorage.setItem("opendatalens_session_id", sId);
  }, sessionPrefix);

  const page = await context.newPage();

  // 1. Homepage & Hero
  console.log("Capturing 1. Homepage & Hero...");
  await page.goto(`${LIVE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "phase6_1_01_homepage.png"), fullPage: false });

  // 2. Curated Explorer & Benchmark Catalog
  console.log("Capturing 2. Curated Dataset Discovery...");
  await page.goto(`${LIVE_URL}/explorer`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Iris Flower Dataset", { timeout: 30000 });
  await page.waitForTimeout(1000);

  // Mount Iris
  const mountIrisBtn = page.getByRole("button", { name: /^Mount$|^Reload$/i }).first();
  if (await mountIrisBtn.isVisible()) {
    await mountIrisBtn.click();
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "phase6_1_02_explorer_iris.png"), fullPage: false });

  // 3. Platform Dashboard with Active Iris Dataset
  console.log("Capturing 3. Platform Dashboard...");
  await page.goto(`${LIVE_URL}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "phase6_1_03_dashboard_active.png"), fullPage: false });

  // 4. Data Quality Intelligence & Copilot
  console.log("Capturing 4. Data Quality & Copilot...");
  await page.goto(`${LIVE_URL}/quality`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // Trigger Copilot
  const copilotBtn = page.getByRole("button", { name: /Explain my dataset|AI Copilot/i }).first();
  if (await copilotBtn.isVisible()) {
    await copilotBtn.click();
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "phase6_1_04_quality_copilot.png"), fullPage: false });

  // 5. Visual Analytics Studio
  console.log("Capturing 5. Visual Analytics Studio...");
  await page.goto(`${LIVE_URL}/visualize`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT_DIR, "phase6_1_05_visual_analytics.png"), fullPage: false });

  // 6. ML Training Studio & Model Comparison
  console.log("Capturing 6. ML Training Studio & Comparison...");
  await page.goto(`${LIVE_URL}/studio`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const trainBtn = page.getByRole("button", { name: /Dispatch Parallel Training Job/i });
  if (await trainBtn.isVisible()) {
    await trainBtn.click();
    // Wait for comparison page
    try {
      await page.waitForURL("**/comparison", { timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT_DIR, "phase6_1_06_model_comparison.png"), fullPage: false });
    } catch (err) {
      console.log("Comparison navigation wait note:", err.message);
      await page.screenshot({ path: path.join(OUT_DIR, "phase6_1_06_ml_studio.png"), fullPage: false });
    }
  }

  // 7. Data Drift Monitor
  console.log("Capturing 7. Data Drift Monitor...");
  await page.goto(`${LIVE_URL}/drift`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "phase6_1_07_drift_monitor.png"), fullPage: false });

  // 8. Reports & Dossier Hub
  console.log("Capturing 8. Reports Hub...");
  await page.goto(`${LIVE_URL}/reports`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "phase6_1_08_reports_hub.png"), fullPage: false });

  // 9. Dark Theme Toggle on Dashboard
  console.log("Capturing 9. Dark Theme on Dashboard...");
  await page.goto(`${LIVE_URL}/dashboard`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "phase6_1_09_dashboard_dark.png"), fullPage: false });

  await context.close();

  // 10. Mobile Responsive Layout (Pixel 5)
  console.log("Capturing 10. Mobile Responsive Layout (Pixel 5)...");
  const pixel5 = devices["Pixel 5"];
  const mobileContext = await browser.newContext({
    ...pixel5,
  });
  await mobileContext.addInitScript((sId) => {
    window.localStorage.setItem("opendatalens_tour_seen", "true");
    window.localStorage.setItem("opendatalens_workspace_id", sId);
  }, sessionPrefix);
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${LIVE_URL}/dashboard`, { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({ path: path.join(OUT_DIR, "phase6_1_10_mobile_dashboard.png"), fullPage: false });
  await mobileContext.close();

  await browser.close();
  console.log("=== Screenshots captured successfully! ===");
}

run().catch((err) => {
  console.error("Screenshot capture error:", err);
  process.exit(1);
});
