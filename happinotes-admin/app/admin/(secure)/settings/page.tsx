"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import countryRegions from "@/lib/data/countries.json";

type RegionPrice = {
  regionCode: string;
  currencyCode: string;
  regularPrice: string;
  offerPrice: string;
  googlePlayAvailable: boolean;
  appleAppStoreAvailable: boolean;
};
type Plan = {
  key: "monthly" | "yearly";
  productId: string;
  storeProductIds?: { android?: string; ios?: string };
  priceInr: number;
  billingPeriod: string;
  priceVersion?: number;
  priceVersionHistory?: Array<{ version: number; priceInr: number; publishedAt: string; storeProductIds?: { android?: string; ios?: string }; regionalPricing?: Array<{ regionCode: string; currencyCode: string; regularPrice: number; offerPrice: number }> }>;
  storeSyncStatus?: { android?: { version: number; status: string; message?: string }; ios?: { version: number; status: string; message?: string } };
  storePriceVersions?: { android?: number; ios?: number };
  regionalPricing?: Array<Omit<RegionPrice, "regularPrice" | "offerPrice"> & { regularPrice: number; offerPrice: number }>;
};
type Country = { code: string; name: string; currency: string };
type PublishResponse = { success: boolean; store: "android" | "ios"; plan: Plan; storeStatus: { version: number; status: string; message?: string } };

const countries = (countryRegions as Country[]).filter((country) => country.code.length === 2).sort((a, b) => a.name.localeCompare(b.name));
const byCode = new Map(countries.map((country) => [country.code, country]));

function newRegion(code: string): RegionPrice {
  const country = byCode.get(code)!;
  return { regionCode: code, currencyCode: country.currency, regularPrice: "", offerPrice: "", googlePlayAvailable: false, appleAppStoreAvailable: false };
}

function toRows(plan: Plan): RegionPrice[] {
  const saved = (plan.regionalPricing ?? []).map((row) => ({ ...row, regularPrice: String(row.regularPrice), offerPrice: String(row.offerPrice) }));
  if (saved.length) return saved;
  // Seed India's current proposal for the monthly plan; admins can edit before saving.
  if (plan.key === "monthly") return [{ ...newRegion("IN"), regularPrice: "1999", offerPrice: "699" }];
  return [];
}

function discount(row: RegionPrice): string {
  const regular = Number(row.regularPrice);
  const offer = Number(row.offerPrice);
  if (!(regular > 0) || !(offer > 0) || offer > regular) return "—";
  return `${(((regular - offer) / regular) * 100).toFixed(2)}%`;
}

export default function AdminSettingsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rows, setRows] = useState<Record<string, RegionPrice[]>>({});
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState<Record<string, boolean>>({});
  const [copySource, setCopySource] = useState<Record<string, string>>({});
  const [nextProductIds, setNextProductIds] = useState<Record<string, { android: string; ios: string }>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState<string | null>(null);

  async function load() {
    const token = window.localStorage.getItem("admin_token") || "";
    const response = await apiRequest<{ plans: Plan[] }>("/admin/subscription-plans", "GET", undefined, token);
    setPlans(response.plans);
    setRows(Object.fromEntries(response.plans.map((plan) => [plan.key, toRows(plan)])));
    setNextProductIds(Object.fromEntries(response.plans.map((plan) => [plan.key, { android: "", ios: "" }])));
  }

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load plans")); }, []);

  const visibleCountries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return countries.filter((country) => !query || country.name.toLocaleLowerCase().includes(query) || country.code.toLocaleLowerCase().includes(query) || country.currency.toLocaleLowerCase().includes(query));
  }, [search]);

  function toggleCountry(planKey: string, code: string) {
    const current = rows[planKey] ?? [];
    const exists = current.some((row) => row.regionCode === code);
    if (exists) {
      setRows((value) => ({ ...value, [planKey]: current.filter((row) => row.regionCode !== code) }));
      setSelected((value) => ({ ...value, [planKey]: (value[planKey] ?? []).filter((entry) => entry !== code) }));
      return;
    }
    setRows((value) => ({ ...value, [planKey]: [...current, newRegion(code)].sort((a, b) => (byCode.get(a.regionCode)?.name ?? a.regionCode).localeCompare(byCode.get(b.regionCode)?.name ?? b.regionCode)) }));
  }

  function updateRegion(planKey: string, code: string, field: keyof RegionPrice, value: string | boolean) {
    setRows((current) => ({ ...current, [planKey]: (current[planKey] ?? []).map((row) => row.regionCode === code ? { ...row, [field]: value } : row) }));
  }

  function toggleTarget(planKey: string, code: string) {
    setSelected((current) => {
      const selectedForPlan = current[planKey] ?? [];
      return { ...current, [planKey]: selectedForPlan.includes(code) ? selectedForPlan.filter((item) => item !== code) : [...selectedForPlan, code] };
    });
  }

  function copyPrices(planKey: string) {
    const sourceCode = copySource[planKey];
    const targets = selected[planKey] ?? [];
    const source = rows[planKey]?.find((row) => row.regionCode === sourceCode);
    if (!source || !targets.length) return;
    setRows((current) => ({ ...current, [planKey]: (current[planKey] ?? []).map((row) => targets.includes(row.regionCode) ? { ...row, regularPrice: source.regularPrice, offerPrice: source.offerPrice } : row) }));
    setMessage(`Copied ${source.currencyCode} amounts as starting values. Adjust them for each selected market.`);
  }

  async function publishStore(plan: Plan, store: "android" | "ios") {
    const token = window.localStorage.getItem("admin_token") || "";
    const planRows = rows[plan.key] ?? [];
    if (!planRows.length) { setMessage(`Add at least one country for the ${plan.key} plan.`); return; }
    const invalid = planRows.find((row) => !Number.isFinite(Number(row.regularPrice)) || !Number.isFinite(Number(row.offerPrice)) || Number(row.regularPrice) <= 0 || Number(row.offerPrice) <= 0 || Number(row.offerPrice) > Number(row.regularPrice));
    if (invalid) { setMessage(`Check the regular and offer prices for ${byCode.get(invalid.regionCode)?.name ?? invalid.regionCode}. The offer must be positive and no higher than the regular price.`); return; }
    const savedPrices = (plan.regionalPricing ?? []).map(({ regionCode, currencyCode, regularPrice, offerPrice }) => ({ regionCode, currencyCode, regularPrice, offerPrice })).sort((a, b) => a.regionCode.localeCompare(b.regionCode));
    const editedPrices = planRows.map(({ regionCode, currencyCode, regularPrice, offerPrice }) => ({ regionCode, currencyCode, regularPrice: Number(regularPrice), offerPrice: Number(offerPrice) })).sort((a, b) => a.regionCode.localeCompare(b.regionCode));
    const startsNewVersion = JSON.stringify(savedPrices) !== JSON.stringify(editedPrices);
    const productIds = nextProductIds[plan.key] ?? { android: "", ios: "" };
    const storeEnabled = planRows.some((row) => store === "android" ? row.googlePlayAvailable : row.appleAppStoreAvailable);
    if (!storeEnabled) { setMessage(`Enable ${store === "android" ? "Google Play" : "Apple App Store"} in at least one selected country first.`); return; }
    const storeNeedsNewId = startsNewVersion || (plan.storePriceVersions?.[store] ?? 1) < (plan.priceVersion ?? 1);
    if (storeNeedsNewId && !productIds[store].trim()) { setMessage(`Enter a new ${store === "android" ? "Google Play" : "Apple"} product ID. Create it in that store before publishing.`); return; }
    setSaving(`${plan.key}:${store}`); setMessage("");
    try {
      const regionalPricing = planRows.map((row) => ({ ...row, regularPrice: Number(row.regularPrice), offerPrice: Number(row.offerPrice) }));
      const response = await apiRequest<PublishResponse>(`/admin/subscription-plans/${plan.key}/publish/${store}`, "POST", { regionalPricing, productId: productIds[store] }, token);
      setPlans((current) => current.map((item) => item.key === plan.key ? response.plan : item));
      if (response.success) {
        setMessage(`${store === "android" ? "Google Play" : "Apple App Store"} confirmed price version ${response.storeStatus.version} live.`);
        await load();
      } else {
        setMessage(`${store === "android" ? "Google Play" : "Apple App Store"} update ${response.storeStatus.status}: ${response.storeStatus.message ?? "store did not confirm the price"}`);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not publish prices"); }
    finally { setSaving(null); }
  }

  function storeStatusLabel(plan: Plan, store: "android" | "ios") {
    const record = plan.storeSyncStatus?.[store];
    if (!record || record.status === "unknown") return "Status not checked";
    if (record.status === "live" && record.version === (plan.priceVersion ?? 1)) return `Live · version ${record.version}`;
    if (record.status === "live") return `Previous version live · version ${record.version}; current version not published`;
    return `${record.status} · version ${record.version}${record.message ? ` · ${record.message}` : ""}`;
  }

  return (
    <div style={{ maxWidth: 1120 }}>
      <h1 style={{ marginTop: 0 }}>Subscription plans</h1>
      <p style={{ color: "#a1a1aa" }}>Set regular and offer prices by market. The offer price is the target amount sent to the selected store; this app does not add GST on top. Customers see the final localized price returned by their store. Confirm how India GST should be reflected in the store price with finance or a tax professional before publishing. The discount is calculated automatically. Configure Google Play and Apple availability independently.</p>
      <div style={{ display: "grid", gap: 18 }}>
        {plans.map((plan) => {
          const planRows = rows[plan.key] ?? [];
          const publishIds = nextProductIds[plan.key] ?? { android: "", ios: "" };
          return <section key={plan.key} style={{ border: "1px solid #232329", borderRadius: 12, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>{plan.key === "monthly" ? "Monthly plan" : "Yearly plan"}</h2>
            {plan.key === "monthly" && <p style={{ color: "#d4d4d8", fontSize: 13, marginTop: -6 }}>India launch pricing: <strong>₹1,999/month reference</strong> and <strong>₹699/month offer</strong> ({(((1999 - 699) / 1999) * 100).toFixed(2)}% off). ₹699 is the recurring renewal price for subscribers who join at this offer; it does not switch to ₹1,999 after a trial period. The price cohort remains at its rate while subscribed. After cancellation and expiry, a returning subscriber gets the then-current price.</p>}
            <p style={{ color: "#a1a1aa", fontSize: 13 }}>Current price version: <strong>{plan.priceVersion ?? 1}</strong><br />Google Play product: {plan.storeProductIds?.android ?? plan.productId} — {storeStatusLabel(plan, "android")}<br />Apple product: {plan.storeProductIds?.ios ?? "Not configured"} — {storeStatusLabel(plan, "ios")}</p>
            {(plan.priceVersionHistory ?? []).length > 0 && <details style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 14 }}><summary>Archived price versions ({plan.priceVersionHistory!.length})</summary><ul>{[...(plan.priceVersionHistory ?? [])].reverse().map((version) => <li key={version.version}>Version {version.version} · {version.regionalPricing?.map((row) => `${row.regionCode}: ${row.currencyCode} ${row.offerPrice}/mo`).join(", ") || `INR ${version.priceInr}`} · Google: {version.storeProductIds?.android ?? "not set"} · Apple: {version.storeProductIds?.ios ?? "not set"} · saved {new Date(version.publishedAt).toLocaleDateString()}</li>)}</ul><p>Keep archived store products available for current subscribers to renew at their existing rate.</p></details>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <label style={{ color: "#d4d4d8", fontSize: 13 }}>New Google Play product ID<input aria-label={`New Google Play product ID for ${plan.key}`} placeholder="Create in Google Play first" value={nextProductIds[plan.key]?.android ?? ""} onChange={(event) => setNextProductIds((value) => ({ ...value, [plan.key]: { ...(value[plan.key] ?? { android: "", ios: "" }), android: event.target.value } }))} style={{ ...inputStyle, width: 245, display: "block", marginTop: 5 }} /></label>
              <label style={{ color: "#d4d4d8", fontSize: 13 }}>New Apple product ID<input aria-label={`New Apple product ID for ${plan.key}`} placeholder="Create in App Store Connect first" value={nextProductIds[plan.key]?.ios ?? ""} onChange={(event) => setNextProductIds((value) => ({ ...value, [plan.key]: { ...(value[plan.key] ?? { android: "", ios: "" }), ios: event.target.value } }))} style={{ ...inputStyle, width: 245, display: "block", marginTop: 5 }} /></label>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              <button type="button" onClick={() => setPickerOpen((value) => ({ ...value, [plan.key]: !value[plan.key] }))} style={buttonStyle}>{pickerOpen[plan.key] ? "Close country list" : `Add countries / regions (${planRows.length} selected)`}</button>
              <label style={{ color: "#d4d4d8", fontSize: 13 }}>Copy prices from
                <select value={copySource[plan.key] ?? ""} onChange={(event) => setCopySource((value) => ({ ...value, [plan.key]: event.target.value }))} style={selectStyle}>
                  <option value="">Choose a market</option>{planRows.map((row) => <option key={row.regionCode} value={row.regionCode}>{byCode.get(row.regionCode)?.name ?? row.regionCode} ({row.currencyCode})</option>)}
                </select>
              </label>
              <button type="button" disabled={!copySource[plan.key] || !(selected[plan.key]?.length)} onClick={() => copyPrices(plan.key)} style={buttonStyle}>Copy to selected rows</button>
            </div>
            {pickerOpen[plan.key] && <div style={{ maxWidth: 480, maxHeight: 330, overflow: "auto", border: "1px solid #34343e", borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search country, region, or currency" aria-label="Search countries and regions" style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                {visibleCountries.map((country) => <label key={country.code} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", color: "#e4e4e7", fontSize: 13 }}>
                  <input type="checkbox" checked={planRows.some((row) => row.regionCode === country.code)} onChange={() => toggleCountry(plan.key, country.code)} />
                  <span>{country.name} <small style={{ color: "#a1a1aa" }}>· {country.code} · {country.currency}</small></span>
                </label>)}
              </div>
              {!visibleCountries.length && <p style={{ color: "#a1a1aa" }}>No matching country or region.</p>}
            </div>}
            {!planRows.length ? <p style={{ color: "#a1a1aa" }}>No markets selected yet.</p> : <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 860, textAlign: "left" }}>
                <thead><tr>{["Copy", "Market / currency", "Regular price", "Offer price", "Discount", "Google Play flag", "Apple App Store flag", ""].map((heading) => <th key={heading} style={thStyle}>{heading}</th>)}</tr></thead>
                <tbody>{planRows.map((row) => <tr key={row.regionCode}>
                  <td style={tdStyle}><input type="checkbox" aria-label={`Select ${byCode.get(row.regionCode)?.name} as a copy target`} checked={(selected[plan.key] ?? []).includes(row.regionCode)} onChange={() => toggleTarget(plan.key, row.regionCode)} /></td>
                  <td style={tdStyle}><strong>{byCode.get(row.regionCode)?.name ?? row.regionCode}</strong><br /><small style={{ color: "#a1a1aa" }}>{row.regionCode} · {row.currencyCode}</small></td>
                  <td style={tdStyle}><input type="number" min="0.01" step="0.01" aria-label={`${row.regionCode} regular price (${row.currencyCode})`} value={row.regularPrice} onChange={(event) => updateRegion(plan.key, row.regionCode, "regularPrice", event.target.value)} style={inputStyle} /></td>
                  <td style={tdStyle}><input type="number" min="0.01" step="0.01" aria-label={`${row.regionCode} offer price (${row.currencyCode})`} value={row.offerPrice} onChange={(event) => updateRegion(plan.key, row.regionCode, "offerPrice", event.target.value)} style={inputStyle} /></td>
                  <td style={tdStyle}>{discount(row)}</td>
                  <td style={tdStyle}><label><input type="checkbox" checked={row.googlePlayAvailable} onChange={(event) => updateRegion(plan.key, row.regionCode, "googlePlayAvailable", event.target.checked)} /> Enabled</label></td>
                  <td style={tdStyle}><label><input type="checkbox" checked={row.appleAppStoreAvailable} onChange={(event) => updateRegion(plan.key, row.regionCode, "appleAppStoreAvailable", event.target.checked)} /> Enabled</label></td>
                  <td style={tdStyle}><button type="button" onClick={() => toggleCountry(plan.key, row.regionCode)} style={{ ...buttonStyle, padding: "6px 9px" }}>Remove</button></td>
                </tr>)}</tbody>
              </table>
            </div>}
            <p style={{ color: "#a1a1aa", fontSize: 12, marginBottom: 0 }}>Review the price preview before publishing. Each store is updated separately, and only a store-confirmed price version becomes available to that store’s new subscribers.</p>
            <button type="button" disabled={Boolean(saving) || !planRows.length} onClick={() => setPreviewPlan(plan.key)} style={{ ...buttonStyle, marginTop: 14, background: "#f97316", borderColor: "#f97316" }}>Preview & publish</button>
            {previewPlan === plan.key && <div role="dialog" aria-modal="true" aria-labelledby={`preview-title-${plan.key}`} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.72)", display: "grid", placeItems: "center", padding: 20 }}>
              <section style={{ width: "min(900px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#17171d", border: "1px solid #3a3a45", borderRadius: 14, padding: 22 }}>
                <h2 id={`preview-title-${plan.key}`} style={{ marginTop: 0 }}>Review {plan.key} subscription prices</h2>
                <p style={{ color: "#a1a1aa" }}>Compare the target regular and offer prices by market. Publishing sends the offer amount to that store and verifies it. HappiNotes does not add tax after the store price; confirm India GST treatment with finance or a tax professional. Customers see the store’s final localized checkout price.</p>
                <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560, textAlign: "left" }}><thead><tr>{["Country", "Currency", "Regular", "Offer", "Discount", "Google Play", "Apple"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead><tbody>{planRows.map((row) => <tr key={row.regionCode}><td style={tdStyle}>{byCode.get(row.regionCode)?.name ?? row.regionCode}</td><td style={tdStyle}>{row.currencyCode}</td><td style={tdStyle}>{row.regularPrice}</td><td style={tdStyle}>{row.offerPrice}</td><td style={tdStyle}>{discount(row)}</td><td style={tdStyle}>{row.googlePlayAvailable ? "Selected" : "Off"}</td><td style={tdStyle}>{row.appleAppStoreAvailable ? "Selected" : "Off"}</td></tr>)}</tbody></table></div>
                <p style={{ color: "#d4d4d8" }}>Google Play product: {publishIds.android.trim() || plan.storeProductIds?.android || plan.productId}<br />Google Play: {storeStatusLabel(plan, "android")}<br />Apple product: {publishIds.ios.trim() || plan.storeProductIds?.ios || "Not configured"}<br />Apple App Store: {storeStatusLabel(plan, "ios")}</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button type="button" disabled={Boolean(saving)} onClick={() => void publishStore(plan, "android")} style={buttonStyle}>{saving === `${plan.key}:android` ? "Publishing to Google Play..." : "Publish to Google Play"}</button>
                  <button type="button" disabled={Boolean(saving)} onClick={() => void publishStore(plan, "ios")} style={buttonStyle}>{saving === `${plan.key}:ios` ? "Publishing to Apple..." : "Publish to Apple App Store"}</button>
                  <button type="button" disabled={Boolean(saving)} onClick={() => setPreviewPlan(null)} style={buttonStyle}>Close</button>
                </div>
              </section>
            </div>}
          </section>;
        })}
      </div>
      {message ? <p role="status" style={{ marginTop: 16, color: "#d4d4d8" }}>{message}</p> : null}
    </div>
  );
}

const buttonStyle: React.CSSProperties = { padding: "9px 12px", borderRadius: 8, border: "1px solid #3a3a45", background: "#202027", color: "white", cursor: "pointer" };
const selectStyle: React.CSSProperties = { marginLeft: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid #3a3a45", background: "#12131a", color: "white" };
const inputStyle: React.CSSProperties = { width: 116, border: "1px solid #3a3a45", borderRadius: 8, background: "#12131a", color: "white", padding: "8px 10px" };
const thStyle: React.CSSProperties = { padding: "10px 8px", color: "#a1a1aa", fontSize: 12, fontWeight: 600, borderBottom: "1px solid #34343e" };
const tdStyle: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #232329", fontSize: 13, verticalAlign: "middle" };
