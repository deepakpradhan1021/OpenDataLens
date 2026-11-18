import assert from "node:assert";
import { parseCsvToRecords } from "../src/lib/workspace-restore.ts";

console.log("=== Testing parseCsvToRecords ===");

// 1. Basic CSV
const csv1 = `id,name,value\n1,Alice,100\n2,Bob,200.5`;
const res1 = parseCsvToRecords(csv1);
assert.strictEqual(res1.rowCount, 2);
assert.deepStrictEqual(res1.columns, ["id", "name", "value"]);
assert.deepStrictEqual(res1.records[0], { id: 1, name: "Alice", value: 100 });
assert.deepStrictEqual(res1.records[1], { id: 2, name: "Bob", value: 200.5 });
console.log("✓ Basic CSV passed");

// 2. Quoted fields with commas, newlines, and escaped quotes
const csv2 = `id,description,status\n1,"Hello, World!","active"\n2,"Multi\nline\ntext","pending"\n3,"He said ""Quotes"" here",null`;
const res2 = parseCsvToRecords(csv2);
assert.strictEqual(res2.rowCount, 3);
assert.strictEqual(res2.records[0].description, "Hello, World!");
assert.strictEqual(res2.records[1].description, "Multi\nline\ntext");
assert.strictEqual(res2.records[2].description, 'He said "Quotes" here');
assert.strictEqual(res2.records[2].status, null);
console.log("✓ Quoted fields with commas, newlines, and escaped quotes passed");

// 3. Types: boolean, nulls, leading zeros
const csv3 = `flag_true,flag_false,empty,nan_val,code\nTRUE,false,,NaN,01234`;
const res3 = parseCsvToRecords(csv3);
assert.strictEqual(res3.records[0].flag_true, true);
assert.strictEqual(res3.records[0].flag_false, false);
assert.strictEqual(res3.records[0].empty, null);
assert.strictEqual(res3.records[0].nan_val, null);
assert.strictEqual(res3.records[0].code, "01234"); // Leading zero string preserved
console.log("✓ Type inference and null casting passed");

// 4. Large CSV (>10,000 rows) performance & memory check
console.log("Generating 10,500 row CSV benchmark...");
const startGen = Date.now();
const rows = ["id,category,amount,active"];
for (let i = 1; i <= 10500; i++) {
  rows.push(`${i},Category_${i % 5},${(i * 1.5).toFixed(2)},${i % 2 === 0}`);
}
const largeCsv = rows.join("\n");
console.log(`Generated in ${Date.now() - startGen}ms (${(largeCsv.length / 1024).toFixed(1)} KB)`);

const startParse = Date.now();
const resLarge = parseCsvToRecords(largeCsv);
const parseDuration = Date.now() - startParse;
console.log(`Parsed 10,500 rows in ${parseDuration}ms!`);

assert.strictEqual(resLarge.rowCount, 10500);
assert.strictEqual(resLarge.records[10499].id, 10500);
assert.strictEqual(resLarge.records[10499].category, "Category_0");
assert.strictEqual(resLarge.records[10499].active, true);
assert(parseDuration < 500, "10,500 rows must parse in < 500ms");

console.log("✓ All CSV parser tests passed successfully!");
