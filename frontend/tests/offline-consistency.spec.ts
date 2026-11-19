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

    // 16. Configure chart dimensions: X = category, Y = amount
    const selects = page.locator("div.space-y-4 select");
    const xAxisSelect = selects.nth(0);
    const yAxisSelect = selects.nth(1);

    await expect(xAxisSelect).toBeVisible({ timeout: 10000 });
    await xAxisSelect.selectOption("category");
    await expect(yAxisSelect).toBeVisible({ timeout: 10000 });
    await yAxisSelect.selectOption("amount");

    // Wait for client aggregation to compute over all 10,200 rows
    await page.waitForTimeout(600);

    // 17. Verify Mathematical Aggregation Parity on Full Offline Dataset (10,200 rows)
    // Expected exact values for 10,200 rows across categories:
    // Alpha:   count: 2040, sum: 15613650.00, mean: 7653.75
    // Beta:    count: 2040, sum: 15601410.00, mean: 7647.75
    // Gamma:   count: 2040, sum: 15604470.00, mean: 7649.25
    // Delta:   count: 2040, sum: 15607530.00, mean: 7650.75
    // Epsilon: count: 2040, sum: 15610590.00, mean: 7652.25
    const expectedMap: Record<string, { count: number; mean: number; sum: number }> = {
      Alpha: { count: 2040, mean: 7653.75, sum: 15613650.00 },
      Beta: { count: 2040, mean: 7647.75, sum: 15601410.00 },
      Gamma: { count: 2040, mean: 7649.25, sum: 15604470.00 },
      Delta: { count: 2040, mean: 7650.75, sum: 15607530.00 },
      Epsilon: { count: 2040, mean: 7652.25, sum: 15610590.00 },
    };

    const offlineChartData = await page.evaluate(() => {
      return (window as any).__opendatalens_activeChartData || [];
    });

    expect(offlineChartData.length).toBe(5);

    let totalObservations = 0;
    for (const item of offlineChartData) {
      const exp = expectedMap[item.name];
      expect(exp).toBeDefined();
      expect(item.count).toBe(exp.count);
      // Explicit floating-point tolerance of ±0.1 for mean aggregation
      expect(Math.abs(item.value - exp.mean)).toBeLessThanOrEqual(0.1);
      totalObservations += item.count;
    }
    // Proves conclusively that all 10,200 rows were aggregated, NOT the 50 preview rows
    expect(totalObservations).toBe(10200);

    // Verify DOM table rendering
    const tableRows = page.locator("table tbody tr");
    await expect(tableRows).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      const rowText = await tableRows.nth(i).innerText();
      expect(rowText).toContain("2040");
    }

    // Now toggle aggregation operator to 'sum'
    const sumBtn = page.getByRole("button", { name: "sum" }).first();
    if (await sumBtn.isVisible()) {
      await sumBtn.click();
      await page.waitForTimeout(500);

      const sumChartData = await page.evaluate(() => {
        return (window as any).__opendatalens_activeChartData || [];
      });
      for (const item of sumChartData) {
        const exp = expectedMap[item.name];
        expect(exp).toBeDefined();
        expect(item.count).toBe(exp.count);
        // Explicit floating-point tolerance of ±1.0 for multi-million sum aggregation
        expect(Math.abs(item.value - exp.sum)).toBeLessThanOrEqual(1.0);
      }
    }
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
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      const defaultPrevented = event.defaultPrevented;
      sync.isSaving = false;
      return defaultPrevented;
    });
    expect(guardFires).toBe(true);
  });

  test("6. Regression: Benchmark CSV network failure preserves cache without quota misclassification", async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/explorer");

    // Intercept dataset-csv download to fail with 500
    await page.route("**/api/reports/dataset-csv**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Simulated benchmark download network failure" }),
      });
    });

    // Mount Iris benchmark
    const mountBtn = page.locator("button:has-text('Mount')").first();
    await expect(mountBtn).toBeVisible({ timeout: 15000 });
    await mountBtn.click();

    // Verify error notification is surfaced
    await expect(page.getByText(/Could not download full dataset CSV|Synchronization failed/i).first()).toBeVisible({ timeout: 15000 });

    // Verify IndexedDB was NOT marked with raw_csv_omitted_for_quota: true
    const checkResult = await page.evaluate(async () => {
      const localDB = (window as any).__opendatalens_localDB;
      const sync = (window as any).__opendatalens_workspaceSync;
      const wsId = window.localStorage.getItem("opendatalens_workspace_id") || "default";
      const ds = await localDB?.getDataset(wsId);
      return {
        hasPendingWork: sync?.hasPendingWork() || false,
        raw_csv_omitted_for_quota: Boolean(ds?.raw_csv_omitted_for_quota),
      };
    });

    expect(checkResult.raw_csv_omitted_for_quota).toBe(false);
    expect(checkResult.hasPendingWork).toBe(false);
  });

  test("7. Regression: Converted non-CSV download failure preserves cache without quota misclassification", async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/explorer");
    await page.locator("[data-testid='tab-upload']").click();

    // Intercept dataset-csv download to fail with 500
    await page.route("**/api/reports/dataset-csv**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Simulated converted CSV network failure" }),
      });
    });

    // Upload a JSON file (non-CSV that triggers backend conversion and CSV fetch)
    const jsonContent = JSON.stringify([
      { id: 1, name: "Item A", score: 95 },
      { id: 2, name: "Item B", score: 88 },
    ]);
    const fileUploadInput = page.locator("input[type='file']").first();
    await fileUploadInput.setInputFiles({
      name: "sample_dataset.json",
      mimeType: "application/json",
      buffer: Buffer.from(jsonContent, "utf-8"),
    });

    // Verify warning/error surfaced
    await expect(page.getByText(/Could not download converted dataset CSV|Synchronization failed/i).first()).toBeVisible({ timeout: 15000 });

    // Verify IndexedDB does NOT have raw_csv_omitted_for_quota: true
    const checkResult = await page.evaluate(async () => {
      const localDB = (window as any).__opendatalens_localDB;
      const sync = (window as any).__opendatalens_workspaceSync;
      const wsId = window.localStorage.getItem("opendatalens_workspace_id") || "default";
      const ds = await localDB?.getDataset(wsId);
      return {
        hasPendingWork: sync?.hasPendingWork() || false,
        raw_csv_omitted_for_quota: Boolean(ds?.raw_csv_omitted_for_quota),
      };
    });

    expect(checkResult.raw_csv_omitted_for_quota).toBe(false);
    expect(checkResult.hasPendingWork).toBe(false);
  });

  test("8. Regression: Inconsistent dataset rejected safely without permanent stuck pending-save or navigation lock", async ({ page }) => {
    await page.goto("/explorer");

    const result = await page.evaluate(async () => {
      const sync = (window as any).__opendatalens_workspaceSync;
      const wsId = window.localStorage.getItem("opendatalens_workspace_id") || "default";

      // 1. Attempt to save an inconsistent dataset (new records with NO raw_csv and NO quota flag)
      const saveResult = await sync.saveDatasetSnapshotImmediately({
        workspace_id: wsId,
        metadata: { id: wsId, name: "Inconsistent Update" },
        columns: [{ name: "c1", dtype: "int64", non_null_count: 1, null_count: 0, unique_count: 1 }],
        records: [{ c1: 999 }],
        total_rows: 1,
        total_cols: 1,
        memory_mb: 0.1,
        raw_csv: undefined,
        raw_csv_omitted_for_quota: false,
        updated_at: new Date().toISOString(),
      });

      // 2. Check synchronization state
      const hasPending = sync.hasPendingWork();
      const isSyncing = sync.isSynchronizing();
      const rejected = sync.getLastRejectedSnapshot();

      // 3. Dispatch beforeunload event to confirm navigation is NOT blocked
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);

      return {
        saveResult,
        hasPending,
        isSyncing,
        hasRejectedSnapshot: Boolean(rejected && rejected.dataset),
        defaultPrevented: event.defaultPrevented,
      };
    });

    // Inconsistent save must be rejected
    expect(result.saveResult).toBe(false);
    // Must NOT be stuck in pending state
    expect(result.hasPending).toBe(false);
    expect(result.isSyncing).toBe(false);
    // Rejected snapshot is safely preserved
    expect(result.hasRejectedSnapshot).toBe(true);
    // Navigation guard must NOT be triggered when there is no real pending work
    expect(result.defaultPrevented).toBe(false);
  });

  test("9. Regression: Overlapping and concurrent immediate/debounced saves execute safely with final outcome", async ({ page }) => {
    await page.goto("/explorer");

    const concurrencyResult = await page.evaluate(async () => {
      const sync = (window as any).__opendatalens_workspaceSync;
      const wsId = window.localStorage.getItem("opendatalens_workspace_id") || "default";

      const validSnapshot1 = {
        workspace_id: wsId,
        metadata: { id: wsId, name: "Valid Batch 1" },
        columns: [{ name: "x", dtype: "int64", non_null_count: 1, null_count: 0, unique_count: 1 }],
        records: [{ x: 1 }],
        total_rows: 1,
        total_cols: 1,
        memory_mb: 0.1,
        raw_csv: "x\n1\n",
        raw_csv_omitted_for_quota: false,
        updated_at: new Date().toISOString(),
      };

      const validSnapshot2 = {
        workspace_id: wsId,
        metadata: { id: wsId, name: "Valid Batch 2" },
        columns: [{ name: "x", dtype: "int64", non_null_count: 2, null_count: 0, unique_count: 2 }],
        records: [{ x: 1 }, { x: 2 }],
        total_rows: 2,
        total_cols: 1,
        memory_mb: 0.1,
        raw_csv: "x\n1\n2\n",
        raw_csv_omitted_for_quota: false,
        updated_at: new Date().toISOString(),
      };

      // Trigger debounced save first
      sync.queueAutoSave({
        visualizations: {
          workspace_id: wsId,
          active_chart_type: "bar",
          x_axis_col: "x",
          y_axis_col: "",
          aggregation: "count",
          bins: 10,
          bin_numeric: true,
          sort_by: "auto",
          top_n: 15,
          saved_presets: [],
          updated_at: new Date().toISOString(),
        },
      }, 500);

      // Concurrently trigger two immediate saves
      const [res1, res2] = await Promise.all([
        sync.saveDatasetSnapshotImmediately(validSnapshot1),
        sync.saveDatasetSnapshotImmediately(validSnapshot2),
      ]);

      const localDB = (window as any).__opendatalens_localDB;
      const finalDataset = await localDB.getDataset(wsId);

      return {
        res1,
        res2,
        hasPending: sync.hasPendingWork(),
        isSyncing: sync.isSynchronizing(),
        finalRowCount: finalDataset?.total_rows,
        finalCsv: finalDataset?.raw_csv,
      };
    });

    // Both concurrent immediate saves must resolve true
    expect(concurrencyResult.res1).toBe(true);
    expect(concurrencyResult.res2).toBe(true);
    expect(concurrencyResult.hasPending).toBe(false);
    expect(concurrencyResult.isSyncing).toBe(false);
    // Final dataset must reflect the latest consistent snapshot
    expect(concurrencyResult.finalRowCount).toBe(2);
    expect(concurrencyResult.finalCsv).toContain("x\n1\n2");
  });
});
