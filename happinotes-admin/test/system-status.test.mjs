import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chartGeometry,
  deploymentTone,
  infrastructurePoints,
  formatMetric,
  formatUptime,
  formatBytes,
  mongoConnectionUsage,
} from "../lib/system-status.ts";
test("missing metrics stay missing and charts never bridge a disconnected sample", () => {
  const geometry = chartGeometry([
    { at: "2026-11-16T00:00:00Z", value: 1 },
    { at: "2026-11-16T00:00:05Z", value: null },
    { at: "2026-11-16T00:00:10Z", value: 2 },
  ]);
  assert.equal(geometry.line.match(/M/g).length, 2);
  assert.equal(geometry.line.includes("L"), false);
  assert.equal(geometry.coordinates[1].y, null);
  assert.equal(formatMetric(null), "—");
  assert.ok(!chartGeometry([]).line.includes("NaN"));
});
test("Railway timestamps and units are preserved", () => {
  const points = infrastructurePoints(
    {
      metrics: [
        {
          measurement: "MEMORY_USAGE_GB",
          values: [{ ts: 1794787200, value: 0.5 }],
        },
      ],
    },
    "MEMORY_USAGE_GB",
  );
  assert.equal(points[0].value, 0.5);
  assert.equal(points[0].at, "2026-11-16T00:00:00.000Z");
  assert.deepEqual(infrastructurePoints(null, "CPU_USAGE"), []);
});
test("deployment status distinguishes progress, failure, success and unknown", () => {
  assert.equal(deploymentTone("BUILDING"), "warning");
  assert.equal(deploymentTone("SUCCESS"), "success");
  assert.equal(deploymentTone("CRASHED"), "danger");
  assert.equal(deploymentTone(), "default");
  assert.equal(formatUptime(3661), "1h 1m");
});
test("database sizes preserve small nonzero values and missing capacity is not zero", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(325), "325 B");
  assert.equal(formatBytes(4096), "4 KiB");
  assert.equal(formatBytes(1.3 * 1048576), "1.3 MiB");
  assert.equal(formatBytes(null), "—");
  assert.equal(formatBytes(NaN), "—");
  assert.equal(mongoConnectionUsage(16, null), null);
  assert.equal(mongoConnectionUsage(null, 292956), null);
  assert.equal(mongoConnectionUsage(0, 0), null);
  assert.deepEqual(mongoConnectionUsage(0, 100), { total: 100, percent: 0 });
  assert.deepEqual(mongoConnectionUsage(10, 90), { total: 100, percent: 10 });
});
