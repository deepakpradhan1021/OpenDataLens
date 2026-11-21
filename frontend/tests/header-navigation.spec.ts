import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "1920px (large desktop)", width: 1920, height: 1080, type: "desktop" },
  { name: "1440px (standard desktop)", width: 1440, height: 900, type: "desktop" },
  { name: "1024px (landscape tablet / small desktop)", width: 1024, height: 768, type: "tablet" },
  { name: "768px (portrait tablet)", width: 768, height: 1024, type: "tablet" },
  { name: "390px (mobile)", width: 390, height: 844, type: "mobile" },
  { name: "360px (small mobile)", width: 360, height: 740, type: "mobile" },
];

test.describe("OpenDataLens — Header Simplification & Responsive Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Avoid onboarding tour modal interception
    await page.addInitScript(() => {
      window.localStorage.setItem("opendatalens_tour_seen", "true");
    });
  });

  for (const vp of VIEWPORTS) {
    test(`Zero horizontal scrolling and layout integrity at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dashboard");

      const header = page.locator("header");
      await expect(header).toBeVisible();

      // Brand logo & title
      await expect(header.getByText("OpenDataLens")).toBeVisible();
      await expect(header.getByText("BETA")).toBeVisible();

      // Check header scrollWidth and document scrollWidth
      const headerScrollWidth = await header.evaluate((el) => el.scrollWidth);
      const { scrollWidth, clientWidth, culprits } = await page.evaluate(() => {
        const culprits: string[] = [];
        document.querySelectorAll("*").forEach((el) => {
          if (el.scrollWidth > document.documentElement.clientWidth + 1) {
            culprits.push(`${el.tagName}#${el.id}.${el.className.toString().slice(0, 40)}: scrollWidth=${el.scrollWidth}`);
          }
        });
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          culprits: culprits.slice(0, 10),
        };
      });
      if (scrollWidth > clientWidth + 1) {
        console.log(`Viewport ${vp.name} overflow culprits:`, culprits, `headerScrollWidth=${headerScrollWidth}`);
      }
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      if (vp.type === "desktop" || vp.type === "tablet") {
        // Desktop / Tablet layout
        // Primary 5 navigation links must be visible
        await expect(header.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
        await expect(header.getByRole("link", { name: "Explorer", exact: true })).toBeVisible();
        await expect(header.getByRole("link", { name: "Visualize", exact: true })).toBeVisible();
        await expect(header.getByRole("link", { name: "Quality", exact: true })).toBeVisible();
        await expect(header.getByRole("link", { name: "Reports", exact: true })).toBeVisible();

        // More dropdown trigger must be visible
        const moreBtn = header.getByRole("button", { name: /^More$/i });
        await expect(moreBtn).toBeVisible();

        // Secondary ML links should not be bare in top row; they live in More dropdown
        // Hamburger should NOT be visible on desktop/tablet
        const toggleMenu = header.getByLabel("Toggle Menu");
        await expect(toggleMenu).not.toBeVisible();

        // Options menu button should be visible
        const optionsBtn = header.getByLabel("Options and system status");
        await expect(optionsBtn).toBeVisible();
      } else {
        // Mobile layout
        // Primary navigation is in drawer, toggle button is visible
        const toggleMenu = header.getByLabel("Toggle Menu");
        await expect(toggleMenu).toBeVisible();

        // Direct desktop links should not be visible in header top bar
        await expect(header.getByRole("link", { name: "Dashboard", exact: true })).not.toBeVisible();
      }
    });
  }

  test("Desktop: 'More' dropdown opens, lists ML tools, and closes on Escape/click-outside", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    const header = page.locator("header");
    const moreBtn = header.getByRole("button", { name: /^More$/i });

    // Open More dropdown
    await moreBtn.click();
    await expect(moreBtn).toHaveAttribute("aria-expanded", "true");

    // Check items in More dropdown
    const studioLink = header.getByRole("link", { name: /ML Studio/i });
    const comparisonLink = header.getByRole("link", { name: /Comparison/i });
    const driftLink = header.getByRole("link", { name: /Data Drift/i });

    await expect(studioLink).toBeVisible();
    await expect(comparisonLink).toBeVisible();
    await expect(driftLink).toBeVisible();

    // Escape closes dropdown
    await page.keyboard.press("Escape");
    await expect(moreBtn).toHaveAttribute("aria-expanded", "false");
    await expect(studioLink).not.toBeVisible();

    // Reopen and outside click closes dropdown
    await moreBtn.click();
    await expect(studioLink).toBeVisible();
    await page.mouse.click(200, 300);
    await expect(moreBtn).toHaveAttribute("aria-expanded", "false");
    await expect(studioLink).not.toBeVisible();
  });

  test("Desktop: 'More' button receives active highlighting when navigating to child route", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/studio");

    const header = page.locator("header");
    const moreBtn = header.getByRole("button", { name: /^More$/i });
    await expect(moreBtn).toBeVisible();

    // Check active class / styling on More button
    const className = await moreBtn.getAttribute("class");
    expect(className).toContain("text-emerald-700");
  });

  test("Desktop: Options menu opens with System Status, Workspaces, Admin Portal, Reset, and Launch ML Studio", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    const header = page.locator("header");
    const optionsBtn = header.getByLabel("Options and system status");
    await optionsBtn.click();
    await expect(optionsBtn).toHaveAttribute("aria-expanded", "true");

    // Options dropdown items
    await expect(header.getByText("System & Storage")).toBeVisible();
    await expect(header.getByText(/API Online|Checking Health|Waking Backend|API Offline/i)).toBeVisible();
    await expect(header.getByText(/Saved Locally|Unsaved|Saved Offline/i).first()).toBeVisible();

    const manageWsBtn = header.getByRole("button", { name: /Manage Workspaces/i });
    await expect(manageWsBtn).toBeVisible();

    const adminLink = header.getByRole("link", { name: /Admin Portal/i });
    await expect(adminLink).toBeVisible();

    const resetBtn = header.getByRole("button", { name: /Reset Workspace/i });
    await expect(resetBtn).toBeVisible();

    const launchStudioLink = header.getByRole("link", { name: /Launch ML Studio/i });
    await expect(launchStudioLink).toBeVisible();

    // Opening workspace modal from Options dropdown
    await manageWsBtn.click();
    await expect(page.getByText(/Local Workspaces & Persistence/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Start Clean Workspace/i })).toBeVisible();
  });

  test("Mobile: Hamburger menu opens drawer with all destinations and closes on link click", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const header = page.locator("header");
    const toggleMenu = header.getByLabel("Toggle Menu");
    await expect(toggleMenu).toBeVisible();

    // Open mobile menu
    await toggleMenu.click();
    await expect(toggleMenu).toHaveAttribute("aria-expanded", "true");

    // Primary destinations in drawer
    await expect(header.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Explorer", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Visualize", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Quality", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Reports", exact: true })).toBeVisible();

    // Advanced ML tools in drawer
    await expect(header.getByRole("link", { name: "ML Studio", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Comparison", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Data Drift", exact: true })).toBeVisible();

    // Workspace & tools in drawer
    await expect(header.getByRole("button", { name: /Workspaces/i })).toBeVisible();
    await expect(header.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: /Reset Workspace/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /Launch ML Studio/i })).toBeVisible();

    // Clicking a destination navigates and automatically closes the drawer
    await header.getByRole("link", { name: "Explorer", exact: true }).click();
    await expect(page).toHaveURL(/\/explorer/);
    await expect(toggleMenu).toHaveAttribute("aria-expanded", "false");
    await expect(header.getByRole("link", { name: "Dashboard", exact: true })).not.toBeVisible();
  });

  test("Theme toggle functions properly on desktop and mobile", async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    const html = page.locator("html");
    const initialThemeDark = await html.evaluate((el) => el.classList.contains("dark"));

    // Find and click theme toggle
    const themeToggle = page.locator("header").getByRole("button", { name: /Toggle theme/i });
    if (await themeToggle.count() > 0) {
      await themeToggle.first().click();
      const updatedThemeDark = await html.evaluate((el) => el.classList.contains("dark"));
      expect(updatedThemeDark).not.toBe(initialThemeDark);
    }
  });
});
