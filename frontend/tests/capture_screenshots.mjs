import { chromium } from "playwright";
import path from "path";

const OUT_DIR = "C:/Users/deepa/.gemini/antigravity/brain/e1b46517-96f3-49ca-9124-efcfc559bd1d/screenshots";
const BASE_URL = "http://localhost:3000";

const ROUTES = [
  { name: "01_landing", path: "/" },
  { name: "02_dashboard", path: "/dashboard" },
  { name: "03_explorer", path: "/explorer" },
  { name: "04_quality", path: "/quality" },
  { name: "05_visualize", path: "/visualize" },
  { name: "06_studio", path: "/studio" },
  { name: "07_comparison", path: "/comparison" },
  { name: "08_reports", path: "/reports" },
];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addInitScript(() => {
    window.localStorage.setItem("opendatalens_tour_seen", "true");
    window.localStorage.setItem("opendatalens_workspace_id", "demo_workspace_screenshots");
  });

  const page = await context.newPage();

  // 1. Mount a dataset so subpages have rich content
  console.log("Pre-mounting Iris dataset...");
  try {
    await page.goto(`${BASE_URL}/explorer`, { waitUntil: "networkidle" });
    const mountBtn = page.getByRole("button", { name: /Mount|Reload/i }).first();
    if (await mountBtn.isVisible()) {
      await mountBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    console.warn("Mount failed or skipped:", e.message);
  }

  // 2. Capture Light Theme Screenshots
  for (const route of ROUTES) {
    console.log(`Capturing Light: ${route.name}`);
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });
    // Ensure light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT_DIR, `${route.name}_light.png`),
      fullPage: false,
    });
  }

  // 3. Capture Dark Theme Screenshots
  for (const route of ROUTES) {
    console.log(`Capturing Dark: ${route.name}`);
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });
    // Switch to dark theme
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT_DIR, `${route.name}_dark.png`),
      fullPage: false,
    });
  }

  // 4. Capture Mobile Viewports
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(OUT_DIR, `09_mobile_home_light.png`),
  });

  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(OUT_DIR, `09_mobile_home_dark.png`),
  });

  await browser.close();
  console.log("All screenshots captured successfully!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
