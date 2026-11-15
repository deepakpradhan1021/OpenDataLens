import { chromium } from "playwright";
import path from "path";

const OUT_DIR = "C:/Users/deepa/.gemini/antigravity/brain/e1b46517-96f3-49ca-9124-efcfc559bd1d/screenshots";
const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("Launching browser for screenshot capture...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addInitScript(() => {
    window.localStorage.setItem("opendatalens_tour_seen", "true");
    window.localStorage.setItem("opendatalens_workspace_id", "demo_viz_session");
  });

  const page = await context.newPage();

  // 1. Mount California Housing Dataset
  console.log("Mounting California Housing dataset...");
  await page.goto(`${BASE_URL}/explorer`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Find California Housing card button or click mount
  const calCard = page.locator("text=California Housing").first();
  if (await calCard.isVisible()) {
    const parentCard = calCard.locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')]");
    const mountBtn = parentCard.getByRole("button", { name: /Mount|Load|Reload/i }).first();
    if (await mountBtn.isVisible()) {
      await mountBtn.click();
      await page.waitForTimeout(2000);
      console.log("California Housing dataset mounted!");
    }
  }

  // 2. Navigate to Visualize Page
  console.log("Navigating to Visualize page...");
  await page.goto(`${BASE_URL}/visualize`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Set Light theme
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  });
  await page.waitForTimeout(1000);

  // Capture Visualize Page (Default Binned Bar/Line Chart)
  console.log("Capturing Visualize Page (Light)...");
  await page.screenshot({
    path: path.join(OUT_DIR, "viz_california_housing_binned_light.png"),
    fullPage: false,
  });

  // Switch to Line Chart
  const lineBtn = page.getByRole("button", { name: /^Line$/i });
  if (await lineBtn.isVisible()) {
    await lineBtn.click();
    await page.waitForTimeout(1000);
    console.log("Capturing Line Chart (Light)...");
    await page.screenshot({
      path: path.join(OUT_DIR, "viz_california_housing_line_light.png"),
      fullPage: false,
    });
  }

  // Switch to Scatter Chart
  const scatterBtn = page.getByRole("button", { name: /^Scatter$/i });
  if (await scatterBtn.isVisible()) {
    await scatterBtn.click();
    await page.waitForTimeout(1000);
    console.log("Capturing Scatter Chart (Light)...");
    await page.screenshot({
      path: path.join(OUT_DIR, "viz_california_housing_scatter_light.png"),
      fullPage: false,
    });
  }

  // 3. Open AI Copilot in Light Theme
  console.log("Opening AI Copilot (Light)...");
  const copilotBtn = page.getByRole("button", { name: /AI Copilot|AI Analyst/i }).first();
  if (await copilotBtn.isVisible()) {
    await copilotBtn.click();
    await page.waitForTimeout(1000);
    console.log("Capturing Copilot (Light)...");
    await page.screenshot({
      path: path.join(OUT_DIR, "copilot_violet_identity_light.png"),
      fullPage: false,
    });
  }

  // 4. Switch to Dark Theme & Capture Copilot
  console.log("Switching to Dark Theme...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  });
  await page.waitForTimeout(1000);
  console.log("Capturing Copilot (Dark)...");
  await page.screenshot({
    path: path.join(OUT_DIR, "copilot_violet_identity_dark.png"),
    fullPage: false,
  });

  // Also capture Visualize Page in Dark Theme
  if (await copilotBtn.isVisible()) {
    // Close copilot
    const closeBtn = page.locator("button:has-text('✕'), button:has(.lucide-x)").first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Switch to Histogram or Bar in Dark
  const barBtn = page.getByRole("button", { name: /^Bar$/i });
  if (await barBtn.isVisible()) {
    await barBtn.click();
    await page.waitForTimeout(1000);
    console.log("Capturing Bar Chart (Dark)...");
    await page.screenshot({
      path: path.join(OUT_DIR, "viz_california_housing_binned_dark.png"),
      fullPage: false,
    });
  }

  // 5. Mobile Viewport (iPhone 14)
  console.log("Testing Mobile Viewport...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  console.log("Capturing Visualize Mobile...");
  await page.screenshot({
    path: path.join(OUT_DIR, "viz_mobile_responsive.png"),
    fullPage: false,
  });

  // Open Copilot on Mobile
  if (await copilotBtn.isVisible()) {
    await copilotBtn.click();
    await page.waitForTimeout(1000);
    console.log("Capturing Copilot Mobile...");
    await page.screenshot({
      path: path.join(OUT_DIR, "copilot_mobile_responsive.png"),
      fullPage: false,
    });
  }

  await browser.close();
  console.log("All screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Capture script failed:", err);
  process.exit(1);
});
