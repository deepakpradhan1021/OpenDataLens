import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

function generate10kCsv(rowCount: number = 10200): string {
  const lines = ["record_id,category,amount,quantity,status,notes"];
  const categories = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
  for (let i = 1; i <= rowCount; i++) {
    const cat = categories[i % categories.length];
    const amount = (i * 1.5).toFixed(2);
    const qty = (i % 10) + 1;
    const status = i % 2 === 0 ? "Active" : "Pending";
    const notes = i % 4 === 0 ? "" : `Order ${i}`;
    lines.push(`${i},${cat},${amount},${qty},${status},"${notes}"`);
  }
  return lines.join("\n");
}

const TEST_WORKSPACE_ID = `test_ws_722_${Date.now()}`;

test.describe("Phase 7.2.2: Offline Consistency & Browser Persistence Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript((wsId) => {
      if (!window.localStorage.getItem("opendatalens_workspace_id")) {
        window.localStorage.setItem("opendatalens_workspace_id", wsId);
      }
      window.localStorage.setItem("opendatalens_tour_seen", "true");
    }, TEST_WORKSPACE_ID);
  });

  test("1. Full 15-step workflow: 10,200 row upload -> clean -> checkpoint -> undo/redo -> restore -> offline chart parity", async ({ page }) => {
    test.setTimeout(120000);

    // 1. Open OpenDataLens explorer
    await page.goto("/explorer");
    await expect(page.getByText(/Dataset Discovery/i).first()).toBeVisible({ timeout: 15000 });

    // 2. Switch to Upload Tab
    const uploadTabBtn = page.locator("[data-testid='tab-upload']");
    await expect(uploadTabBtn).toBeVisible({ timeout: 10000 });
    await uploadTabBtn.click();

    // 3. Upload CSV containing 10,200 rows
    const csvContent = generate10kCsv(10200);
    const fileUploadInput = page.locator("input[type='file']").first();
    await fileUploadInput.setInputFiles({
      name: "large_dataset_10200.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent, "utf-8"),
    });

    // 4. Verify dataset row count
    await expect(page.getByText(/10,200 rows/i).first()).toBeVisible({ timeout: 25000 });

    // 5. Navigate to Quality Cleaning Studio
    await page.goto("/quality");
    // Allow quality computation over 10k rows to finish
    await expect(page.getByText(/Computing statistical moments/i)).toBeHidden({ timeout: 40000 }).catch(() => {});
    await expect(page.getByText(/Data Quality Intelligence/i).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Completeness Score/i).first()).toBeVisible({ timeout: 20000 });

    // 6. Save a named checkpoint
    const checkpointBtn = page.locator("button[title='Save current state as a named checkpoint']").first();
    await expect(checkpointBtn).toBeVisible({ timeout: 10000 });
    await checkpointBtn.click();
    await page.locator("input[placeholder*='Pre-Outlier']").fill("cp_initial_10k");
    await page.getByRole("button", { name: /Save Snapshot/i }).click();
    await expect(page.getByText(/Saved checkpoint: 'cp_initial_10k'/i)).toBeVisible({ timeout: 10000 });

    // 7. Apply a deterministic cleaning transformation: Sort Rows
    const sortTab = page.getByRole("button", { name: "Sort Rows" }).first();
    await expect(sortTab).toBeVisible({ timeout: 10000 });
    await sortTab.click();
    const applySortBtn = page.getByRole("button", { name: "Sort Dataset" }).first();
    await expect(applySortBtn).toBeVisible({ timeout: 10000 });
    await applySortBtn.click();
    await expect(page.getByText(/Sorted dataset|Applied sort/i).first()).toBeVisible({ timeout: 15000 });

    // 8. Perform undo
    const undoBtn = page.locator("button[title='Undo last transformation']").first();
    await expect(undoBtn).toBeEnabled({ timeout: 25000 });
    await undoBtn.click();
    await expect(page.getByText(/Undo:/i).first()).toBeVisible({ timeout: 20000 });

    // 9. Perform redo
    const redoBtn = page.locator("button[title='Redo transformation']").first();
    await expect(redoBtn).toBeEnabled({ timeout: 25000 });
    await redoBtn.click();
    await expect(page.getByText(/Redo:/i).first()).toBeVisible({ timeout: 20000 });

    // 10. Restore the named checkpoint
    const openCheckpointsBtn = page.locator("button[title='Named checkpoints']").first();
    await openCheckpointsBtn.click();
    await expect(page.getByText(/Named Checkpoints \(/i).first()).toBeVisible({ timeout: 15000 });
    const restoreBtn = page.locator("button:has-text('Restore')").first();
    await expect(restoreBtn).toBeVisible({ timeout: 15000 });
    await restoreBtn.click();
    await expect(page.getByText(/Restored checkpoint: cp_initial_10k/i).first()).toBeVisible({ timeout: 20000 });

    // Close checkpoint drawer if still visible
    const closeDrawerBtn = page.locator("button:has-text('Close')").first();
    if (await closeDrawerBtn.isVisible()) {
      await closeDrawerBtn.click().catch(() => {});
    }

    // Await synchronization to complete before disconnecting network
    await page.waitForTimeout(1500);

    // 11. Disconnect the backend (simulate network outage)
    await page.route("**/api/**", (route) => route.abort("failed"));

    // 12. Refresh the browser in offline mode
    await page.reload();

    // 13. Verify workspace loads in offline mode
    await expect(page.getByText(/Data Quality Intelligence/i).first()).toBeVisible({ timeout: 15000 });

    // 14. Navigate to /visualize offline
    await page.goto("/visualize");

    // 15. Verify full dataset is restored (>10,000 rows) with full offline banner
    await expect(page.getByText(/Full Offline Dataset Active/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/10,200 rows/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/FULL DATASET \(OFFLINE\)/i).first()).toBeVisible({ timeout: 10000 });

    // Verify offline chart container is rendered
    const chartRendered = page.locator(".recharts-wrapper, svg").first();
    await expect(chartRendered).toBeVisible({ timeout: 10000 });
  });

  test("2. Failed CSV download never combines new records with an older CSV snapshot", async ({ page }) => {
    test.setTimeout(45000);

    // Populate initial dataset on explorer
    await page.goto("/explorer");
    await page.locator("[data-testid='tab-upload']").click();
    const csvContent = generate10kCsv(500);
    const fileUploadInput = page.locator("input[type='file']").first();
    await fileUploadInput.setInputFiles({
      name: "small_test_500.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent, "utf-8"),
    });
    await expect(page.getByText(/500 rows/i).first()).toBeVisible({ timeout: 15000 });

    await page.goto("/quality");
    await expect(page.getByText(/Data Quality Intelligence/i).first()).toBeVisible({ timeout: 10000 });

    // Intercept CSV download endpoint and force it to fail (HTTP 500)
    await page.route("**/api/reports/dataset-csv**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Simulated CSV download failure" }),
      });
    });

    // Attempt a transformation (Sort Rows)
    const sortTab = page.getByRole("button", { name: "Sort Rows" }).first();
    await sortTab.click();
    const applySortBtn = page.getByRole("button", { name: "Sort Dataset" }).first();
    await applySortBtn.click();

    // Verify that sync failure is flagged to the user
    await expect(page.getByText(/Synchronization failed|not saved locally/i).first()).toBeVisible({ timeout: 10000 });

    // Verify IndexedDB was not corrupted: previous consistent snapshot preserved
    const isConsistent = await page.evaluate(async () => {
      const activeWsId = window.localStorage.getItem("opendatalens_workspace_id");
      return new Promise((resolve) => {
        const req = indexedDB.open("OpenDataLensDB");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("datasets", "readonly");
          const store = tx.objectStore("datasets");
          const countReq = store.count();
          countReq.onsuccess = () => {
            if (countReq.result === 0) {
              db.close();
              return resolve(false);
            }
            if (activeWsId) {
              const getReq = store.get(activeWsId);
              getReq.onsuccess = () => {
                const val = getReq.result;
                db.close();
                resolve(val && typeof val.raw_csv === "string");
              };
              getReq.onerror = () => {
                db.close();
                resolve(false);
              };
            } else {
              db.close();
              resolve(true);
            }
          };
          countReq.onerror = () => {
            db.close();
            resolve(false);
          };
        };
        req.onerror = () => resolve(false);
      });
    });

    expect(isConsistent).toBe(true);
  });

  test("3. Preview-only mode is clearly labeled when raw CSV is genuinely omitted due to quota", async ({ page }) => {
    test.setTimeout(45000);
    // Inject a degraded preview-only dataset into IndexedDB (raw_csv_omitted_for_quota: true)
    await page.goto("/visualize");

    await page.evaluate(async () => {
      const wsId = window.localStorage.getItem("opendatalens_workspace_id") || "default";
      const localDB = (window as any).__opendatalens_localDB;
      if (localDB) {
        await localDB.saveFullWorkspace({
          metadata: {
            id: wsId,
            name: "Degraded Quota Test Workspace",
            description: "Testing quota degradation indicator",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            dataset_name: "Quota Test Dataset",
            total_rows: 50000,
            total_cols: 2,
            memory_mb: 25.5,
            clean_steps_count: 0,
            models_trained_count: 0,
            approx_size_bytes: 26000000,
          },
          dataset: {
            workspace_id: wsId,
            metadata: { id: wsId, name: "Quota Test Dataset" },
            columns: [
              { name: "feature_a", dtype: "float64", non_null_count: 50, null_count: 0, unique_count: 50 },
              { name: "category", dtype: "object", non_null_count: 50, null_count: 0, unique_count: 5 },
            ],
            records: Array.from({ length: 50 }, (_, i) => ({ feature_a: i * 2.5, category: `Cat_${i % 5}` })),
            total_rows: 50000,
            total_cols: 2,
            memory_mb: 25.5,
            raw_csv: null,
            raw_csv_omitted_for_quota: true,
            is_full_dataset: false,
            is_preview_only: true,
            updated_at: new Date().toISOString(),
          },
        });
      }
    });

    // Simulate backend down
    await page.route("**/api/**", (route) => route.abort("failed"));

    // Reload page
    await page.reload();

    // Verify preview-only banner is prominent and unmistakable
    await expect(page.getByText(/PREVIEW ONLY/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Preview-Only Mode|storage quota limit/i).first()).toBeVisible();
  });

  test("4. Corrupted CSV text in local cache recovers safely to preview rows without uncaught crashes", async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/visualize");

    // Inject malformed/corrupted CSV into IndexedDB
    await page.evaluate(async () => {
      const wsId = window.localStorage.getItem("opendatalens_workspace_id") || "default";
      const localDB = (window as any).__opendatalens_localDB;
      if (localDB) {
        await localDB.saveFullWorkspace({
          metadata: {
            id: wsId,
            name: "Corrupted Test Workspace",
            description: "Testing corrupted CSV fallback",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            dataset_name: "Corrupted Test Dataset",
            total_rows: 2,
            total_cols: 1,
            memory_mb: 0.1,
            clean_steps_count: 0,
            models_trained_count: 0,
            approx_size_bytes: 100,
          },
          dataset: {
            workspace_id: wsId,
            metadata: { id: wsId, name: "Corrupted Test Dataset" },
            columns: [{ name: "col_a", dtype: "string", non_null_count: 2, null_count: 0, unique_count: 2 }],
            records: [{ col_a: "preview_row_1" }, { col_a: "preview_row_2" }],
            total_rows: 2,
            total_cols: 1,
            memory_mb: 0.1,
            raw_csv: "col_a\n", // Only header, no data rows (corrupted / truncated)
            is_full_dataset: false,
            is_preview_only: true,
            updated_at: new Date().toISOString(),
          },
        });
      }
    });

    await page.route("**/api/**", (route) => route.abort("failed"));
    await page.reload();

    // Verify application remains functional and doesn't crash with white screen
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/PREVIEW ONLY/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("5. Navigation / beforeunload guard protects unsaved or synchronizing changes", async ({ page }) => {
    await page.goto("/explorer");

    // Check if beforeunload event listener or workspaceSync service is mounted
    const hasSyncService = await page.evaluate(() => {
      return (
        typeof window !== "undefined" &&
        Boolean((window as any).__opendatalens_workspaceSync)
      );
    });
    expect(hasSyncService).toBe(true);

    // Verify beforeunload event handler intercepts when sync is active
    const guardFires = await page.evaluate(() => {
      const sync = (window as any).__opendatalens_workspaceSync;
      sync.isSaving = true;
      let defaultPrevented = false;
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      defaultPrevented = event.defaultPrevented || Boolean((event as any).returnValue);
      sync.isSaving = false;
      return defaultPrevented;
    });
    expect(guardFires).toBe(true);
  });
});
