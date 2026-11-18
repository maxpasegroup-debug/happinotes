import { test } from "node:test";
import assert from "node:assert/strict";
import { securityChartData } from "../lib/user-security-charts.ts";
const now = new Date("2026-11-14T12:00:00Z");
const base = { id: "a", name: "A", status: "active", history: [] };

test("charts count devices and sessions separately, deduplicate accounts and never double-count legacy snapshots", () => {
  const user = {
    ...base,
    devices: [
      { networkType: "wifi", deviceLocation: { latitude: 0, longitude: 0 } },
      { networkType: "cellular", locationStatus: { state: "off" } },
    ],
    network: { networkType: "wifi" },
    legacyNetwork: { networkType: "wifi" },
    vpn: { count: 2 },
    loginHistory: [
      { id: "s", startedAt: "2026-11-14T10:00:00Z", status: "current" },
      { id: "s", startedAt: "2026-11-14T10:00:00Z", status: "current" },
    ],
  };
  const data = securityChartData(
    [
      user,
      user,
      {
        ...base,
        id: "b",
        status: "new_status",
        network: { networkType: "unknown" },
      },
    ],
    7,
    now,
  );
  assert.equal(data.users, 2);
  assert.equal(data.devices, 3);
  assert.equal(data.authorized, 1);
  assert.equal(data.vpnCount, 2);
  assert.equal(
    data.networks.reduce((sum, group) => sum + group.count, 0),
    3,
  );
  assert.equal(data.access.find((group) => group.label === "Other").count, 1);
  assert.equal(
    data.location.find((group) => group.label === "Saved location").count,
    1,
  );
  assert.deepEqual(
    data.networks.find((group) => group.label === "Wi-Fi").userIds,
    ["a"],
  );
});
test("login chart uses UTC days, ignores invalid/future dates and keeps distinct successful logins", () => {
  const dates = [
    "2026-11-14T00:01:00Z",
    "2026-11-13T20:00:00-04:00",
    "2026-11-08T00:00:00Z",
    "2026-11-07T23:59:59Z",
    "2026-11-15T00:00:00Z",
    "invalid",
  ];
  const user = {
    ...base,
    loginHistory: dates.map((startedAt, index) => ({
      id: String(index),
      startedAt,
      status: "replaced",
    })),
  };
  const data = securityChartData([user], 7, now);
  assert.equal(data.days[0].date, "2026-11-08");
  assert.equal(data.days[0].count, 1);
  assert.equal(data.days.at(-1).count, 2);
  assert.deepEqual(data.days.at(-1).userIds, ["a"]);
  assert.equal(data.invalidDates, 1);
  assert.equal(
    data.days.reduce((sum, day) => sum + day.count, 0),
    3,
  );
  assert.equal(
    securityChartData([user], 30, now).days.reduce(
      (sum, day) => sum + day.count,
      0,
    ),
    4,
  );
});
test("missing reporting is not invented as a device, VPN incident or location denial", () => {
  const data = securityChartData([base], 7, now);
  assert.equal(data.devices, 0);
  assert.equal(data.vpnCount, 0);
  assert.equal(data.authorized, 0);
  assert.deepEqual(data.location, []);
  assert.deepEqual(data.networks, []);
  assert.equal(securityChartData([], 7, now).access.length, 0);
});

test("additional charts distinguish platforms, report age, device counts and VPN thresholds", () => {
  const users = [
    {
      ...base,
      devices: [
        {
          _id: "d1",
          os: "HUAWEI/STK-L21M/HWSTK-HF:10/HU",
          lastSeen: "2026-11-14T11:30:00Z",
        },
        {
          _id: "d1",
          os: "HUAWEI/STK-L21M/HWSTK-HF:10/HU",
          lastSeen: "2026-11-14T11:30:00Z",
        },
      ],
      vpn: { count: 2 },
    },
    {
      ...base,
      id: "b",
      devices: [
        { os: "iOS", lastSeen: "2026-11-13T15:00:00Z" },
        { os: "unrecognized", lastSeen: "2026-11-10T00:00:00Z" },
      ],
      vpn: { count: 4 },
    },
    {
      ...base,
      id: "c",
      devices: [
        { os: "Android", lastSeen: "2026-11-01T00:00:00Z" },
        { os: "Android", lastSeen: "bad" },
        { os: "Android", lastSeen: "2026-12-01T00:00:00Z" },
      ],
      vpn: { count: 5 },
    },
    { ...base, id: "d" },
  ];
  const data = securityChartData(users, 7, now);
  assert.equal(data.devices, 6, "the repeated device ID is not counted twice");
  assert.deepEqual(
    data.deviceCounts.map((group) => group.count),
    [1, 1, 1, 1],
  );
  assert.deepEqual(
    data.vpnBands.map((group) => group.count),
    [1, 1, 1, 1],
  );
  assert.equal(
    data.platforms.find((group) => group.label === "Android").count,
    4,
  );
  assert.equal(data.platforms.find((group) => group.label === "iOS").count, 1);
  assert.equal(
    data.platforms.find((group) => group.label === "Unknown").count,
    1,
  );
  assert.equal(
    data.freshness.find((group) => group.label === "Unknown time").count,
    2,
  );
  for (const label of [
    "Within 1 hour",
    "1–24 hours",
    "1–7 days",
    "Over 7 days",
  ])
    assert.equal(
      data.freshness.find((group) => group.label === label).count,
      1,
    );
});
test("heatmap bins only valid retained logins in the selected UTC period and shares daily totals", () => {
  const user = {
    ...base,
    loginHistory: [
      { id: "a", startedAt: "2026-11-14T10:00:00Z", status: "current" },
      { id: "b", startedAt: "2026-11-14T10:45:00Z", status: "replaced" },
      { id: "c", startedAt: "2026-11-10T03:00:00Z", status: "replaced" },
      { id: "d", startedAt: "2026-11-07T03:00:00Z", status: "replaced" },
      { id: "e", startedAt: "2026-11-14T13:00:00Z", status: "replaced" },
    ],
  };
  const data = securityChartData([user], 7, now);
  const saturday = data.heatmap.find((row) => row.label === "Sat").hours[10];
  assert.equal(saturday.count, 2);
  assert.deepEqual(saturday.userIds, ["a"]);
  assert.equal(
    data.heatmap.find((row) => row.label === "Tue").hours[3].count,
    1,
  );
  assert.equal(
    data.heatmap
      .flatMap((row) => row.hours)
      .reduce((sum, cell) => sum + cell.count, 0),
    data.days.reduce((sum, day) => sum + day.count, 0),
  );
});
test("semantic chart colors stay stable when counts reorder on a refresh", () => {
  const first = securityChartData(
    [base, { ...base, id: "b", status: "permanent_ban" }],
    7,
    now,
  );
  const next = securityChartData(
    [
      base,
      { ...base, id: "b", status: "permanent_ban" },
      { ...base, id: "c", status: "permanent_ban" },
    ],
    7,
    now,
  );
  for (const group of first.access)
    assert.equal(
      group.color,
      next.access.find((item) => item.label === group.label).color,
    );
});
