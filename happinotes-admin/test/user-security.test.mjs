import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  handleSecurityLookup,
  publicIp,
  searchableModel,
  lookupDevice,
  lookupIp,
  parseAndroidModels,
} from "../lib/user-security-lookup.ts";
import {
  devicePhotoMessage,
  displayDetail,
  mapCoordinates,
} from "../lib/user-security.ts";

afterEach(() => mock.restoreAll());
const id = "64b000000000000000000002";
const catalogCalls = (fetchMock) =>
  fetchMock.mock.calls.filter(
    (call) =>
      !String(call.arguments[0]).startsWith("https://storage.googleapis.com/"),
  ).length;
const emptyAndroidCatalog = "Retail Branding,Marketing Name,Device,Model\n";
const request = (extra = "", token = "Bearer test-session") =>
  new Request(
    `https://admin.example/api/admin/user-network?userId=${id}${extra}`,
    { headers: token ? { Authorization: token } : {} },
  );

test("requires admin authentication and validates IDs before contacting providers", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("must not fetch");
  });
  assert.equal(
    (await handleSecurityLookup(request("", ""), "https://backend.example"))
      .status,
    401,
  );
  assert.equal(
    (
      await handleSecurityLookup(
        new Request("https://admin.example/api/admin/user-network?userId=bad", {
          headers: { Authorization: "Bearer test" },
        }),
        "https://backend.example",
      )
    ).status,
    400,
  );
  assert.equal(catalogCalls(fetchMock), 0);
});
test("denied backend admin access cannot trigger public lookups", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async (url, options) => {
    assert.ok(
      String(url).startsWith("https://backend.example/admin/user-security?"),
    );
    assert.equal(options.headers.Authorization, "Bearer test-session");
    return Response.json({ message: "forbidden" }, { status: 403 });
  });
  const response = await handleSecurityLookup(
    request(),
    "https://backend.example",
  );
  assert.equal(response.status, 403);
  assert.equal(catalogCalls(fetchMock), 1);
});
test("uses saved public IP, ignores arbitrary query IP, and never forwards auth to providers", async () => {
  const calls = [];
  mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    calls.push(url);
    if (url.hostname === "backend.example")
      return Response.json({
        users: [{ id, network: { publicIp: "8.8.4.4", deviceModel: "" } }],
      });
    assert.equal(url.hostname, "ipapi.co");
    assert.equal(url.pathname, "/8.8.4.4/json/");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, "error");
    return Response.json({
      latitude: 1.352,
      longitude: 103.82,
      country_name: "Singapore",
      country_code: "SG",
      postal: "018989",
      asn: "AS123",
      org: "Example organization",
    });
  });
  const response = await handleSecurityLookup(
    request("&ip=1.1.1.1&model=private-name"),
    "https://backend.example",
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.publicIp, "8.8.4.4");
  assert.equal(body.geo.countryCode, "SG");
  assert.equal(body.geo.postal, "018989");
  assert.equal(body.geo.asn, "AS123");
  assert.equal(body.geo.latitude, 1.352);
  assert.equal(body.geo.proxy, undefined);
  assert.equal(body.device.status, "not_found");
  assert.equal(calls.length, 2);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
test("does not look up records missing from the authenticated user page", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({ users: [] }),
  );
  assert.equal(
    (await handleSecurityLookup(request(), "https://backend.example")).status,
    404,
  );
  assert.equal(catalogCalls(fetchMock), 1);
});
test("private, local, reserved and invalid IPs are never sent to geolocation", async () => {
  const fetchMock = mock.method(globalThis, "fetch", () => {
    throw new Error("must not fetch");
  });
  for (const value of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "192.168.1.3",
    "100.64.1.1",
    "203.0.113.1",
    "::1",
    "fd00::1",
    "fe80::1",
    "2001:db8::1",
    "https://evil.example",
  ]) {
    assert.equal(publicIp(value), undefined);
    assert.equal((await lookupIp(value)).status, "no_public_ip");
  }
  assert.equal(publicIp("::ffff:8.8.8.8"), "8.8.8.8");
  assert.equal(publicIp("2606:4700:4700::1111"), "2606:4700:4700::1111");
  assert.equal(catalogCalls(fetchMock), 0);
});
test("quota failures are explicit and repeated lookups are cached", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({}, { status: 429 }),
  );
  assert.equal((await lookupIp("1.0.0.1")).status, "rate_limited");
  assert.equal((await lookupIp("1.0.0.1")).status, "rate_limited");
  assert.equal(catalogCalls(fetchMock), 2);
});
test("does not invent risk results or treat absent values as safe", () => {
  assert.equal(displayDetail(undefined), "Not provided");
  assert.equal(displayDetail(false), "No");
  assert.equal(displayDetail(0), "0");
  assert.deepEqual(
    mapCoordinates({ status: "approximate", latitude: 0, longitude: 0 }),
    [0, 0],
  );
  for (const geo of [
    {},
    { status: "unavailable", latitude: 1, longitude: 2 },
    { status: "approximate", latitude: NaN, longitude: 2 },
    { status: "approximate", latitude: 1, longitude: 181 },
  ])
    assert.equal(mapCoordinates(geo), null);
});
test("device search rejects arbitrary names, IPs, URLs and email addresses", () => {
  for (const value of [
    "John Smith",
    "person@example.com",
    "https://evil.example",
    "8.8.8.8",
    "John's phone",
    undefined,
  ])
    assert.equal(searchableModel(value), null);
  assert.equal(searchableModel("Pixel 8"), "Pixel 8");
  assert.equal(searchableModel("SM-S918B"), "SM-S918B");
});
function photoReplies(
  model,
  license = "CC BY-SA 4.0",
  host = "upload.wikimedia.org",
) {
  const replies = [
    { search: [{ id: "Q10" }] },
    {
      entities: {
        Q10: {
          id: "Q10",
          labels: { en: { value: model } },
          claims: {
            P18: [
              {
                rank: "normal",
                mainsnak: {
                  snaktype: "value",
                  datavalue: { value: "Example.jpg" },
                },
              },
            ],
          },
        },
      },
    },
    {
      query: {
        pages: [
          {
            imageinfo: [
              {
                thumburl: `https://${host}/example.jpg`,
                descriptionurl:
                  "https://commons.wikimedia.org/wiki/File:Example.jpg",
                extmetadata: {
                  Artist: {
                    value: '<a href="https://example.org">Photographer</a>',
                  },
                  LicenseShortName: { value: license },
                  LicenseUrl: {
                    value: "https://creativecommons.org/licenses/by-sa/4.0/",
                  },
                },
              },
            ],
          },
        ],
      },
    },
  ];
  return mock.method(globalThis, "fetch", async (url, options) => {
    assert.ok(
      ["www.wikidata.org", "commons.wikimedia.org"].includes(url.hostname),
    );
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, undefined);
    return Response.json(replies.shift());
  });
}
test("device reference photo retains attribution and is cached by model", async () => {
  const fetchMock = photoReplies("Pixel 8");
  const result = await lookupDevice("Pixel 8");
  assert.equal(result.status, "found");
  assert.equal(result.author, "Photographer");
  assert.equal(result.license, "CC BY-SA 4.0");
  assert.deepEqual(await lookupDevice("Pixel 8"), result);
  assert.equal(catalogCalls(fetchMock), 3);
});
test("device image rejects non-free licenses and untrusted image hosts", async () => {
  photoReplies("Pixel 9", "CC BY-NC 4.0");
  assert.equal((await lookupDevice("Pixel 9")).status, "not_found");
  mock.restoreAll();
  photoReplies("Pixel 7", "CC BY-SA 4.0", "evil.example");
  assert.equal((await lookupDevice("Pixel 7")).status, "not_found");
});
test("unrelated model results and catalog outages return placeholders", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ search: [] }));
  assert.equal((await lookupDevice("iPhone 15")).status, "not_found");
  mock.restoreAll();
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  const results = await Promise.all([
    lookupDevice("Pixel 6"),
    lookupDevice("Pixel 6"),
  ]);
  assert.ok(results.every((result) => result.status === "unavailable"));
  assert.equal(catalogCalls(fetchMock), 1);
});

test("cached provider results still require current admin authorization", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({}, { status: 401 }),
  );
  const response = await handleSecurityLookup(
    request(),
    "https://backend.example",
  );
  assert.equal(response.status, 401);
  assert.equal(catalogCalls(fetchMock), 1);
  assert.equal((await response.json()).geo, undefined);
});
test("operator disable switch prevents sending even public IPs to providers", async () => {
  const before = process.env.ADMIN_IP_LOOKUP_ENABLED;
  process.env.ADMIN_IP_LOOKUP_ENABLED = "false";
  try {
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("must not fetch");
    });
    assert.equal((await lookupIp("8.8.8.8")).status, "disabled");
    assert.equal(catalogCalls(fetchMock), 0);
  } finally {
    if (before === undefined) delete process.env.ADMIN_IP_LOOKUP_ENABLED;
    else process.env.ADMIN_IP_LOOKUP_ENABLED = before;
  }
});
test("per-session lookup limit bounds repeated backend and provider work", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({ users: [{ id, network: {} }] }),
  );
  for (let index = 0; index < 30; index++)
    assert.equal(
      (
        await handleSecurityLookup(
          request("", "Bearer rate-limit-test"),
          "https://backend.example",
        )
      ).status,
      200,
    );
  assert.equal(
    (
      await handleSecurityLookup(
        request("", "Bearer rate-limit-test"),
        "https://backend.example",
      )
    ).status,
    429,
  );
  assert.equal(catalogCalls(fetchMock), 30);
});

let lookupModule = 0;
const freshLookup = () =>
  import(`../lib/user-security-lookup.ts?quota-test=${++lookupModule}`);
const backupData = {
  success: true,
  latitude: 1.35,
  longitude: 103.82,
  country: "Singapore",
  country_code: "SG",
  city: "Singapore",
  postal: "018989",
  connection: { asn: 60068, org: "Example network", isp: "Example ISP" },
  timezone: { id: "Asia/Singapore" },
};
test("primary quota switches to the backup without leaking the primary API key", async () => {
  const { lookupIp } = await freshLookup();
  const before = process.env.SECURITY_GEOIP_API_KEY;
  process.env.SECURITY_GEOIP_API_KEY = "test-key-only";
  try {
    const calls = [];
    mock.method(globalThis, "fetch", async (url, options) => {
      calls.push(url.hostname);
      assert.equal(options.headers.Authorization, undefined);
      if (url.hostname === "ipapi.co")
        return Response.json(
          {},
          { status: 429, headers: { "Retry-After": "120" } },
        );
      assert.equal(url.hostname, "ipwho.is");
      assert.equal(url.searchParams.get("key"), null);
      assert.equal(url.pathname, "/1.1.1.1");
      return Response.json(backupData);
    });
    const result = await lookupIp("1.1.1.1");
    assert.equal(result.status, "approximate");
    assert.equal(result.source, "ipwho.is");
    assert.equal(result.asn, "AS60068");
    assert.equal(result.isp, "Example ISP");
    assert.equal(result.countryCode, "SG");
    assert.equal(result.timezone, "Asia/Singapore");
    assert.deepEqual(calls, ["ipapi.co", "ipwho.is"]);
    assert.deepEqual(await lookupIp("1.1.1.1"), result);
    assert.equal(calls.length, 2);
  } finally {
    if (before === undefined) delete process.env.SECURITY_GEOIP_API_KEY;
    else process.env.SECURITY_GEOIP_API_KEY = before;
  }
});
test("provider cooldown applies across different IPs and honors Retry-After", async () => {
  const { lookupIp } = await freshLookup();
  const start = Date.now();
  let now = start;
  mock.method(Date, "now", () => now);
  const calls = [];
  mock.method(globalThis, "fetch", async (url) => {
    calls.push(url.hostname);
    return url.hostname === "ipapi.co"
      ? Response.json({}, { status: 429, headers: { "Retry-After": "120" } })
      : Response.json(backupData);
  });
  await lookupIp("1.1.1.1");
  await lookupIp("8.8.8.8");
  assert.deepEqual(calls, ["ipapi.co", "ipwho.is", "ipwho.is"]);
  now = start + 121000;
  await lookupIp("9.9.9.9");
  assert.deepEqual(calls.slice(-2), ["ipapi.co", "ipwho.is"]);
});
test("falls back on invalid primary data and never creates a marker from invalid backup coordinates", async () => {
  const { lookupIp } = await freshLookup();
  mock.method(globalThis, "fetch", async (url) =>
    Response.json(
      url.hostname === "ipapi.co"
        ? { latitude: "not a number", longitude: 0 }
        : { ...backupData, latitude: 91 },
    ),
  );
  assert.equal((await lookupIp("1.1.1.1")).status, "unavailable");
});
test("keeps an explicitly stale same-IP location during outages, but never beyond seven days", async () => {
  const { lookupIp } = await freshLookup();
  const start = Date.now();
  let now = start;
  mock.method(Date, "now", () => now);
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({ latitude: 10, longitude: 20, country_name: "Example" }),
  );
  const first = await lookupIp("1.1.1.1");
  assert.equal(first.source, "ipapi.co");
  now = start + 25 * 3600000;
  fetchMock.mock.mockImplementation(async () =>
    Response.json({}, { status: 429 }),
  );
  const stale = await lookupIp("1.1.1.1");
  assert.equal(stale.status, "approximate");
  assert.equal(stale.stale, true);
  assert.equal(stale.latitude, first.latitude);
  assert.equal(stale.checkedAt, first.checkedAt);
  now = start + 8 * 86400000;
  assert.equal((await lookupIp("1.1.1.1")).status, "rate_limited");
});
test("both providers exhausted returns a retry time, and backup can be disabled", async () => {
  const { lookupIp } = await freshLookup();
  const calls = [];
  mock.method(globalThis, "fetch", async (url) => {
    calls.push(url.hostname);
    return Response.json(
      {},
      { status: 429, headers: { "Retry-After": "300" } },
    );
  });
  const result = await lookupIp("1.1.1.1");
  assert.equal(result.status, "rate_limited");
  assert.ok(Date.parse(result.retryAt) > Date.now());
  assert.deepEqual(calls, ["ipapi.co", "ipwho.is"]);
  const before = process.env.ADMIN_IP_LOOKUP_FALLBACK;
  process.env.ADMIN_IP_LOOKUP_FALLBACK = "false";
  try {
    const fresh = await freshLookup();
    await fresh.lookupIp("8.8.8.8");
    assert.equal(calls.at(-1), "ipapi.co");
    assert.equal(calls.length, 3);
  } finally {
    if (before === undefined) delete process.env.ADMIN_IP_LOOKUP_FALLBACK;
    else process.env.ADMIN_IP_LOOKUP_FALLBACK = before;
  }
});

const exactEntity = (label, aliases = []) => ({
  labels: { en: { value: label } },
  aliases: { en: aliases.map((value) => ({ value })) },
  claims: {
    P18: [
      {
        rank: "normal",
        mainsnak: {
          snaktype: "value",
          datavalue: { value: "Exact-model.jpg" },
        },
      },
    ],
  },
});
const licensedImage = {
  query: {
    pages: [
      {
        imageinfo: [
          {
            thumburl: "https://upload.wikimedia.org/exact.jpg",
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Exact-model.jpg",
            extmetadata: {
              Artist: { value: "Photographer" },
              LicenseShortName: { value: "CC0" },
              LicenseUrl: {
                value: "https://creativecommons.org/publicdomain/zero/1.0/",
              },
            },
          },
        ],
      },
    ],
  },
};
test("a hardware code needs a complete catalog alias before showing a named model photo", async () => {
  const { lookupDevice } = await freshLookup();
  const replies = [
    { search: [{ id: "Q10" }] },
    {
      entities: { Q10: exactEntity("Samsung Galaxy S23 Ultra", ["SM-S918B"]) },
    },
    licensedImage,
  ];
  const fetchMock = mock.method(globalThis, "fetch", async (url) =>
    String(url).startsWith("https://storage.googleapis.com/")
      ? new Response(emptyAndroidCatalog)
      : Response.json(replies.shift()),
  );
  const result = await lookupDevice("SM-S918B");
  assert.equal(result.status, "found");
  assert.equal(result.matchedModel, "Samsung Galaxy S23 Ultra");
  assert.equal(result.modelSourceUrl, "https://www.wikidata.org/wiki/Q10");
  assert.equal(catalogCalls(fetchMock), 3);
});
test("hardware code mentions in descriptions and search results do not prove a model match", async () => {
  const { lookupDevice } = await freshLookup();
  const replies = [
    { search: [{ id: "Q10", description: "SM-S918B smartphone" }] },
    {
      entities: {
        Q10: {
          ...exactEntity("Samsung Galaxy S23"),
          descriptions: { en: { value: "SM-S918B" } },
        },
      },
    },
  ];
  const fetchMock = mock.method(globalThis, "fetch", async (url) =>
    String(url).startsWith("https://storage.googleapis.com/")
      ? new Response(emptyAndroidCatalog)
      : Response.json(replies.shift()),
  );
  assert.equal((await lookupDevice("SM-S918B")).status, "not_found");
  assert.equal(catalogCalls(fetchMock), 2);
});
test("Plus, Pro and Ultra variants are not replaced with the base model or a family image", async () => {
  for (const [reported, label, aliases] of [
    ["Samsung Galaxy S23+", "Samsung Galaxy S23", []],
    ["Pixel 8 Pro", "Pixel 8", ["Pixel 8 Pro"]],
    ["SM-S918B", "Samsung Galaxy S23 series", ["SM-S918B"]],
    ["iPhone 15 Pro Max", "iPhone 15 Pro and Pro Max", ["iPhone 15 Pro Max"]],
  ]) {
    const { lookupDevice } = await freshLookup();
    const replies = [
      { search: [{ id: "Q10" }] },
      { entities: { Q10: exactEntity(label, aliases) } },
    ];
    const fetchMock = mock.method(globalThis, "fetch", async (url) =>
      String(url).startsWith("https://storage.googleapis.com/")
        ? new Response(emptyAndroidCatalog)
        : Response.json(replies.shift()),
    );
    assert.equal((await lookupDevice(reported)).status, "not_found");
    assert.equal(catalogCalls(fetchMock), 2);
    mock.restoreAll();
  }
});
test("ambiguous exact identities cannot pick the first available photo", async () => {
  const { lookupDevice } = await freshLookup();
  const replies = [
    { search: [{ id: "Q10" }, { id: "Q20" }] },
    { entities: { Q10: exactEntity("Pixel 8"), Q20: exactEntity("Pixel 8") } },
  ];
  const fetchMock = mock.method(globalThis, "fetch", async (url) =>
    String(url).startsWith("https://storage.googleapis.com/")
      ? new Response(emptyAndroidCatalog)
      : Response.json(replies.shift()),
  );
  assert.equal((await lookupDevice("Pixel 8")).status, "not_found");
  assert.equal(catalogCalls(fetchMock), 2);
});
test("Apple hardware identifiers can be searched but require exact alias evidence", async () => {
  assert.equal(searchableModel("iPhone16,1"), "iPhone16,1");
  const { lookupDevice } = await freshLookup();
  const replies = [
    { search: [{ id: "Q10" }] },
    { entities: { Q10: exactEntity("iPhone 15 Pro", ["iPhone16,1"]) } },
    licensedImage,
  ];
  mock.method(globalThis, "fetch", async (url) =>
    String(url).startsWith("https://storage.googleapis.com/")
      ? new Response(emptyAndroidCatalog)
      : Response.json(replies.shift()),
  );
  assert.equal(
    (await lookupDevice("iPhone16,1")).matchedModel,
    "iPhone 15 Pro",
  );
});

test("Android model catalog parses quoted names and rejects conflicting marketing names", () => {
  const rows = parseAndroidModels(
    '\uFEFFRetail Branding,Marketing Name,Device,Model\r\nSamsung,Galaxy S23 Ultra,dm3q,SM-S918B\r\nSamsung,Galaxy S23 Ultra,dm3q2,SM-S918B\r\nVendor,"Phone, Max",p1,X123\r\nVendor,Phone Lite,p2,X123\r\nVendor,"Phone ""Pro""",p3,Z123\r\n',
  );
  assert.equal(rows.get("sm-s918b").name, "Samsung Galaxy S23 Ultra");
  assert.equal(rows.get("x123"), null);
  assert.equal(rows.get("z123").name, 'Vendor Phone "Pro"');
  assert.throws(() => parseAndroidModels("error,data\nwrong,format"));
});
test("Android code resolves automatically to the official marketing name before image search", async () => {
  const { lookupDevice } = await freshLookup();
  let csvRequests = 0;
  mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "storage.googleapis.com") {
      csvRequests++;
      assert.equal(url.search, "");
      assert.equal(options.headers?.Authorization, undefined);
      const csv =
        "\ufeffRetail Branding,Marketing Name,Device,Model\r\nSamsung,Galaxy S23 Ultra,dm3q,SM-S918B\r\n";
      return new Response(Buffer.from(csv, "utf16le"));
    }
    if (url.hostname === "commons.wikimedia.org")
      return Response.json(licensedImage);
    if (url.searchParams.get("action") === "wbsearchentities") {
      assert.equal(url.searchParams.get("search"), "Samsung Galaxy S23 Ultra");
      return Response.json({ search: [{ id: "Q10" }] });
    }
    return Response.json({
      entities: { Q10: exactEntity("Samsung Galaxy S23 Ultra") },
    });
  });
  const result = await lookupDevice("SM-S918B");
  assert.equal(result.status, "found");
  assert.equal(result.resolvedModel, "Samsung Galaxy S23 Ultra");
  assert.equal(result.model, "SM-S918B");
  assert.match(result.modelMappingUrl, /supported_devices.html/);
  assert.equal((await lookupDevice("SM-S918B")).imageUrl, result.imageUrl);
  assert.equal(csvRequests, 1);
});
test("manufacturer model codes are supported without guessing a brand from a prefix", () => {
  for (const value of [
    "V2219",
    "2312DRA50I",
    "M2006C3MI",
    "SM-S918B/DS",
    "XT2343-1",
  ])
    assert.equal(searchableModel(value), value);
  assert.equal(
    devicePhotoMessage({
      status: "unavailable",
      model: "V2219",
      reason: "catalog_unavailable",
    }).includes("could not be reached"),
    true,
  );
});
test("an original Commons photo and older HTTP license URL remain usable without a thumbnail", async () => {
  const { lookupDevice } = await freshLookup();
  const photo = structuredClone(licensedImage);
  const info = photo.query.pages[0].imageinfo[0];
  delete info.thumburl;
  info.url = "https://upload.wikimedia.org/original.jpg";
  info.extmetadata.LicenseUrl.value =
    "http://creativecommons.org/publicdomain/zero/1.0/";
  const replies = [
    { search: [{ id: "Q10" }] },
    { entities: { Q10: exactEntity("Pixel 9") } },
    photo,
  ];
  mock.method(globalThis, "fetch", async () => Response.json(replies.shift()));
  const result = await lookupDevice("Pixel 9");
  assert.equal(result.status, "found");
  assert.equal(result.imageUrl, info.url);
  assert.match(result.licenseUrl, /^https:/);
});
test("image retry can refresh a cached miss after one minute without hammering the catalog", async () => {
  const { lookupDevice } = await freshLookup();
  let now = Date.now();
  mock.method(Date, "now", () => now);
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({ search: [] }),
  );
  assert.equal((await lookupDevice("Pixel 9")).reason, "no_catalog_match");
  await lookupDevice("Pixel 9", true);
  assert.equal(fetchMock.mock.callCount(), 1);
  now += 61000;
  await lookupDevice("Pixel 9");
  assert.equal(fetchMock.mock.callCount(), 1);
  await lookupDevice("Pixel 9", true);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("Serper image headings preserve exact variants and exclude accessories", async () => {
  const { matchesDeviceImageTitle } = await freshLookup();
  assert.equal(
    matchesDeviceImageTitle(
      "Samsung Galaxy S23 Ultra - Full phone specifications",
      "Samsung Galaxy S23 Ultra",
    ),
    true,
  );
  assert.equal(
    matchesDeviceImageTitle("Apple iPhone 15 Pro pictures", "iPhone 15 Pro"),
    true,
  );
  for (const title of [
    "iPhone 15 Pro",
    "iPhone 15 Plus",
    "iPhone 150",
    "iPhone 15 - Case",
    "iPhone 15 vs iPhone 16",
    "iPhone 15 / 16",
    "iPhone 15 wallpaper",
  ]) {
    assert.equal(matchesDeviceImageTitle(title, "iPhone 15"), false, title);
  }
});
test("Serper uses only the model, keeps secrets server-side, selects trusted matching photos and caches", async () => {
  const previous = process.env.SERPER_API_KEY;
  process.env.SERPER_API_KEY = "test-serper-secret";
  try {
    const { lookupDevice } = await freshLookup();
    const fetchMock = mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url, "https://google.serper.dev/images");
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "error");
      assert.equal(options.headers["X-API-KEY"], "test-serper-secret");
      assert.equal(options.headers.Authorization, undefined);
      assert.deepEqual(JSON.parse(options.body), {
        q: '"iPhone 15" device product photo',
        num: 10,
        autocorrect: false,
      });
      return Response.json({
        images: [
          {
            title: "iPhone 15 Pro",
            imageUrl: "https://apple.com/pro.jpg",
            link: "https://apple.com/iphone-15-pro/",
          },
          {
            title: "iPhone 15",
            imageUrl: "https://127.0.0.1/a.jpg",
            link: "https://apple.com/iphone-15/",
          },
          {
            title: "iPhone 15",
            imageUrl: "https://apple.com/a.jpg",
            link: "https://apple.com.evil.example/iphone-15/",
          },
          {
            title: "iPhone 15 - Apple",
            imageUrl: "https://www.apple.com/15.jpg",
            thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=example",
            link: "https://www.apple.com/iphone-15/",
          },
        ],
      });
    });
    const result = await lookupDevice("iPhone 15");
    assert.equal(result.status, "found");
    assert.equal(result.provider, "serper");
    assert.equal(result.imageUrl, "https://www.apple.com/15.jpg");
    assert.equal(result.license, undefined);
    assert.equal(result.author, undefined);
    assert.ok(result.thumbnailUrl);
    assert.ok(!JSON.stringify(result).includes("test-serper-secret"));
    await lookupDevice("iPhone 15");
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally {
    if (previous === undefined) delete process.env.SERPER_API_KEY;
    else process.env.SERPER_API_KEY = previous;
  }
});
test("Serper quota failure falls back without leaking its key and honors provider cooldown across models", async () => {
  const previous = process.env.SERPER_API_KEY;
  process.env.SERPER_API_KEY = "test-cooldown-key";
  try {
    const { lookupDevice } = await freshLookup();
    let calls = 0;
    mock.method(globalThis, "fetch", async (input, options) => {
      const url = new URL(input);
      if (url.hostname === "google.serper.dev") {
        calls++;
        return Response.json(
          {},
          { status: 429, headers: { "Retry-After": "120" } },
        );
      }
      assert.equal(url.hostname, "www.wikidata.org");
      assert.equal(options.headers["X-API-KEY"], undefined);
      return Response.json({ search: [] });
    });
    assert.equal((await lookupDevice("Pixel 9")).reason, "no_catalog_match");
    assert.equal((await lookupDevice("Pixel 8")).reason, "no_catalog_match");
    assert.equal(calls, 1);
  } finally {
    if (previous === undefined) delete process.env.SERPER_API_KEY;
    else process.env.SERPER_API_KEY = previous;
  }
});

test("STK-L21 shared product code is reported as ambiguous without selecting a search image", async () => {
  const { lookupDevice } = await freshLookup();
  const fetchMock = mock.method(globalThis, "fetch", async (input) => {
    assert.equal(
      String(input),
      "https://storage.googleapis.com/play_public/supported_devices.csv",
    );
    return new Response(
      "Retail Branding,Marketing Name,Device,Model\nHuawei,HUAWEI P smart Pro,HWSTK-HF,STK-L21\nHuawei,HUAWEI Y9 Prime 2019,HWSTK-HF,STK-L21\nHuawei,HUAWEI Y9s,HWSTK-HF,STK-L21\n",
    );
  });
  const result = await lookupDevice("STK-L21");
  assert.equal(result.status, "not_found");
  assert.equal(result.reason, "ambiguous_match");
  assert.equal(result.imageUrl, undefined);
  assert.match(devicePhotoMessage(result), /full product name/);
  assert.match(result.modelMappingUrl, /supported_devices.html$/);
  await lookupDevice("STK-L21");
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("shared STK-L21 searches Serper and displays a labeled reference from its image response", async () => {
  const previous = process.env.SERPER_API_KEY;
  process.env.SERPER_API_KEY = "test-reference-key";
  try {
    const { lookupDevice } = await freshLookup();
    let searches = 0;
    mock.method(globalThis, "fetch", async (input, options) => {
      if (String(input).startsWith("https://storage.googleapis.com/"))
        return new Response(
          "Retail Branding,Marketing Name,Device,Model\nHuawei,HUAWEI P smart Pro,HWSTK-HF,STK-L21\nHuawei,HUAWEI Y9 Prime 2019,HWSTK-HF,STK-L21\n",
        );
      assert.equal(String(input), "https://google.serper.dev/images");
      assert.equal(
        JSON.parse(options.body).q,
        '"STK-L21" device product photo',
      );
      searches++;
      return Response.json({
        searchParameters: { type: "images", q: "STK-L21" },
        images: [
          {
            title: "Apple Inc. - Wikipedia",
            link: "https://en.wikipedia.org/wiki/Apple_Inc.",
            thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=apple",
          },
          {
            title: "Huawei STK-L21 replacement LCD",
            link: "https://www.huawei.com/parts",
            thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=lcd",
          },
          {
            title: "Huawei Y9 Prime 2019 STK-L21 128GB Smartphone",
            imageUrl: "https://images.shopcdn.com/phone.jpg",
            thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=phone",
            source: "Phone retailer",
            link: "https://www.phoneretailer.com/huawei/stk-l21",
            position: 3,
          },
        ],
        credits: 1,
      });
    });
    const result = await lookupDevice("STK-L21");
    assert.equal(result.status, "found");
    assert.equal(result.provider, "serper");
    assert.equal(result.sharedModelCode, true);
    assert.equal(result.resolvedModel, undefined);
    assert.equal(
      result.imageUrl,
      "https://encrypted-tbn0.gstatic.com/images?q=phone",
    );
    assert.equal(
      result.searchTitle,
      "Huawei Y9 Prime 2019 STK-L21 128GB Smartphone",
    );
    assert.equal(
      result.sourceUrl,
      "https://www.phoneretailer.com/huawei/stk-l21",
    );
    assert.equal(searches, 1);
  } finally {
    if (previous === undefined) delete process.env.SERPER_API_KEY;
    else process.env.SERPER_API_KEY = previous;
  }
});
test("hardware reference matching uses complete codes and excludes unrelated or accessory titles", async () => {
  const { matchesDeviceImageTitle } = await freshLookup();
  assert.equal(
    matchesDeviceImageTitle("Huawei Y9s (STK-L21) smartphone", "STK-L21"),
    true,
  );
  for (const title of [
    "STK-L210 smartphone",
    "STK-L2 smartphone",
    "STK-L21 charger",
    "STK-L21 motherboard",
    "Apple Inc. - Wikipedia",
  ]) {
    assert.equal(matchesDeviceImageTitle(title, "STK-L21"), false, title);
  }
});
test("reference image source links cannot target local addresses or unsafe protocols", async () => {
  const previous = process.env.SERPER_API_KEY;
  process.env.SERPER_API_KEY = "test-public-sources";
  try {
    const { lookupDevice } = await freshLookup();
    mock.method(globalThis, "fetch", async (input) => {
      if (String(input).startsWith("https://google.serper.dev/"))
        return Response.json({
          images: [
            "https://127.0.0.1/photo",
            "https://192.168.1.1/photo",
            "https://printer.local/photo",
            "https://host.internal/photo",
            "javascript:alert(1)",
            "https://user:pass@huawei.com/phone",
          ].map((link) => ({
            title: "Pixel 9",
            link,
            thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=phone",
          })),
        });
      return Response.json({ search: [] });
    });
    assert.equal((await lookupDevice("Pixel 9")).status, "not_found");
  } finally {
    if (previous === undefined) delete process.env.SERPER_API_KEY;
    else process.env.SERPER_API_KEY = previous;
  }
});

test("Moto G45 matches Motorola naming and retail colors/storage without matching other variants", async () => {
  const { matchesDeviceImageTitle } = await freshLookup();
  for (const title of [
    "Motorola Moto G45 5G - Full phone specifications",
    "Motorola G45 5G pictures",
    "MOTOROLA g45 5G (Brilliant Blue, 128 GB) (8 GB RAM)",
    "moto g45 5g Viva Magenta 4GB 128GB",
  ]) {
    assert.equal(matchesDeviceImageTitle(title, "moto g45 5G"), true, title);
  }
  for (const title of [
    "Motorola G45 4G",
    "Motorola G45 5G Plus",
    "Motorola G45 5G Pro",
    "Motorola G455 5G",
    "Motorola G45 5G (G55)",
    "Motorola G45 5G case",
    "Motorola G45 5G / Moto G55 5G",
  ]) {
    assert.equal(matchesDeviceImageTitle(title, "moto g45 5G"), false, title);
  }
});
test("Moto G45 lookup uses its model, accepts the official regional source and reuses its cache", async () => {
  const previous = process.env.SERPER_API_KEY;
  process.env.SERPER_API_KEY = "test-motorola-key";
  try {
    const { lookupDevice } = await freshLookup();
    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async (input, options) => {
        assert.equal(String(input), "https://google.serper.dev/images");
        assert.equal(
          JSON.parse(options.body).q,
          '"moto g45 5G" device product photo',
        );
        return Response.json({
          images: [
            {
              title: "Motorola Moto G45 5G (Brilliant Blue, 128 GB)",
              imageUrl: "https://www.motorola.in/g45.jpg",
              link: "https://www.motorola.in/smartphones-moto-g-45-5g/p",
            },
          ],
        });
      },
    );
    const result = await lookupDevice("moto g45 5G");
    assert.equal(result.status, "found");
    assert.equal(result.model, "moto g45 5G");
    assert.equal(result.imageUrl, "https://www.motorola.in/g45.jpg");
    await lookupDevice("moto g45 5G");
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally {
    if (previous === undefined) delete process.env.SERPER_API_KEY;
    else process.env.SERPER_API_KEY = previous;
  }
});

test("database device cache survives fresh server modules without spending provider credits", async () => {
  const saved = {
    photo: {
      status: "found",
      model: "moto g45 5G",
      imageUrl: "https://www.motorola.in/photo.jpg",
    },
    checkedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  let reads = 0;
  const store = {
    read: async () => {
      reads++;
      return saved;
    },
    write: async () => assert.fail("cached result must not be written again"),
  };
  mock.method(globalThis, "fetch", () =>
    assert.fail("no provider request for database hit"),
  );
  for (let i = 0; i < 2; i++) {
    const { lookupDevice } = await freshLookup();
    const result = await lookupDevice("moto g45 5G", false, store);
    assert.equal(result.cacheStorage, "mongodb");
    assert.equal(result.imageUrl, saved.photo.imageUrl);
  }
  assert.equal(reads, 2);
});
test("database miss saves the provider result once and subsequent views reuse it", async () => {
  const { lookupDevice } = await freshLookup();
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({ search: [] }),
  );
  let writes = 0;
  const store = {
    read: async () => null,
    write: async (photo) => {
      writes++;
      assert.equal(photo.model, "Pixel 9");
      return true;
    },
  };
  const result = await lookupDevice("Pixel 9", false, store);
  assert.equal(result.cacheStorage, "mongodb");
  await lookupDevice("Pixel 9", false, store);
  assert.equal(writes, 1);
  assert.equal(fetchMock.mock.callCount(), 1);
});
test("database outage falls back to memory and retries saving without another provider call", async () => {
  const { lookupDevice } = await freshLookup();
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({ search: [] }),
  );
  let healthy = false;
  const store = {
    read: async () => {
      throw new Error("offline");
    },
    write: async () => healthy,
  };
  assert.equal(
    (await lookupDevice("Pixel 9", false, store)).cacheStorage,
    "memory",
  );
  healthy = true;
  assert.equal(
    (await lookupDevice("Pixel 9", false, store)).cacheStorage,
    "mongodb",
  );
  assert.equal(fetchMock.mock.callCount(), 1);
});
test("selected device is authorized under its account and drives both IP and persistent image lookup", async () => {
  const { handleSecurityLookup } = await freshLookup();
  const deviceId = "64b000000000000000000003";
  const calls = [];
  mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    calls.push(url);
    if (url.hostname === "backend.example") {
      assert.equal(options.headers.Authorization, "Bearer test-session");
      if (url.pathname.endsWith("/device-reference")) {
        assert.equal(url.searchParams.get("deviceId"), deviceId);
        return Response.json({
          photo: { model: "Pixel 9", status: "not_found" },
          checkedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        });
      }
      return Response.json({
        users: [
          {
            id,
            network: { publicIp: "1.1.1.1" },
            devices: [
              { _id: deviceId, publicIp: "8.8.4.4", deviceModel: "Pixel 9" },
            ],
          },
        ],
      });
    }
    assert.equal(url.hostname, "ipapi.co");
    assert.equal(url.pathname, "/8.8.4.4/json/");
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({ latitude: 1, longitude: 1 });
  });
  const response = await handleSecurityLookup(
    request(`&deviceId=${deviceId}`),
    "https://backend.example",
  );
  const body = await response.json();
  assert.equal(body.deviceId, deviceId);
  assert.equal(body.publicIp, "8.8.4.4");
  assert.equal(body.device.cacheStorage, "mongodb");
  assert.equal(calls.length, 3);
  const missing = await handleSecurityLookup(
    request("&deviceId=64b000000000000000000009"),
    "https://backend.example",
  );
  assert.equal(missing.status, 404);
  assert.equal(calls.length, 4);
});

test("older snapshot remains independently selectable when the account has modern devices", async () => {
  const deviceId = "64b000000000000000000099";
  const fetchMock = mock.method(globalThis, "fetch", async (input) => {
    assert.ok(
      String(input).startsWith("https://backend.example/admin/user-security?"),
    );
    return Response.json({
      users: [
        {
          id,
          network: { _id: deviceId, publicIp: "10.0.0.2" },
          legacyNetwork: { publicIp: "10.0.0.1" },
          devices: [{ _id: deviceId, publicIp: "10.0.0.2" }],
        },
      ],
    });
  });
  const old = await (
    await handleSecurityLookup(
      request("", "Bearer legacy-history-test"),
      "https://backend.example",
    )
  ).json();
  const modern = await (
    await handleSecurityLookup(
      request(`&deviceId=${deviceId}`, "Bearer legacy-history-test"),
      "https://backend.example",
    )
  ).json();
  assert.equal(old.publicIp, "10.0.0.1");
  assert.equal(old.deviceId, undefined);
  assert.equal(modern.publicIp, "10.0.0.2");
  assert.equal(modern.deviceId, deviceId);
  assert.equal(fetchMock.mock.calls.length, 2);
});

test("device-location status distinguishes permission, service, build and GPS failures", async () => {
  const { deviceLocationMessage } = await import("../lib/user-security.ts");
  assert.match(deviceLocationMessage("off"), /sharing is off/);
  assert.match(
    deviceLocationMessage("permission_denied"),
    /not granted location permission/,
  );
  assert.match(deviceLocationMessage("native_unavailable"), /rebuilt app/);
  assert.match(deviceLocationMessage("timeout"), /fix in time/);
  assert.match(deviceLocationMessage(), /No location result has been reported/);
});

test("a transient report failure retries and offline IPv4 and IPv6 results use the bundled database", async () => {
  const { handleSecurityLookup } = await freshLookup();
  let ip = "8.8.8.8", reports = 0;
  mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "backend.example") {
      assert.equal(url.searchParams.get("lookupUserId"), id);
      if (++reports === 1) throw new TypeError("connection reset");
      return Response.json({ users: [{ id, network: { publicIp: ip } }] });
    }
    assert.equal(options.headers.Authorization, undefined);
    throw new TypeError("provider DNS failure");
  });
  for (const address of ["8.8.8.8", "2606:4700:4700::1111"]) {
    ip = address;
    const response = await handleSecurityLookup(request(), "https://backend.example");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.publicIp, ip);
    assert.equal(body.geo.source, "DB-IP Lite");
    assert.match(body.geo.countryCode, /^[A-Z]{2}$/);
    assert.match(body.geo.databaseDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(mapCoordinates(body.geo));
  }
  assert.equal(reports, 3);
});

test("unavailable report fails closed before geolocation without exposing upstream details", async () => {
  const fetcher = mock.method(globalThis, "fetch", async input => {
    assert.equal(new URL(input).hostname, "backend.example");
    throw new TypeError("secret address");
  });
  const result = await handleSecurityLookup(request(), "https://backend.example");
  assert.equal(fetcher.mock.callCount(), 2);
  assert.equal(result.status, 503);
  assert.doesNotMatch(await result.text(), /secret|backend\.example/);
});

test("server resolves an unexpanded configured backend selector without trusting the incoming host", async t => {
  const key = "NEXT_PUBLIC_RAILWAY_API_BASE_URL";
  const previous = process.env[key];
  process.env[key] = "https://configured.example";
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  mock.method(globalThis, "fetch", async url => {
    assert.equal(new URL(url).origin, "https://configured.example");
    return Response.json({ users: [{ id, network: { publicIp: "192.168.0.1" } }] });
  });
  const result = await handleSecurityLookup(request(), "$" + key);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).geo.status, "no_public_ip");
});
