"use client";

import AdminModal from "@/components/admin/AdminModal";

import { useAdminConfirmation } from "@/components/admin/ConfirmationProvider";

import { addToast, Card, Skeleton, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, ModalContent, ModalBody, ModalHeader } from "@heroui/react";

import { AdminButton, AdminInput, AdminSelect } from "@/components/admin/ui";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  key: "monthly";
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
  return (plan.regionalPricing ?? []).map((row) => ({
    ...row,
    regularPrice: String(row.regularPrice),
    offerPrice: String(row.offerPrice),
  }));
}

function discount(row: RegionPrice): string {
  const regular = Number(row.regularPrice);
  const offer = Number(row.offerPrice);
  if (!(regular > 0) || !(offer > 0) || offer > regular) return "—";
  return `${(((regular - offer) / regular) * 100).toFixed(2)}%`;
}

function PlansSkeleton() {
  return <div role="status" aria-label="Loading subscription plans">
    <span className="sr-only">Loading subscription plans…</span>
    <Card aria-hidden="true" shadow="none" className="gap-6 border border-divider bg-content1 p-5 sm:p-7">
      <div className="space-y-3">
        <Skeleton className="h-6 w-36 rounded-lg motion-reduce:before:animate-none" />
        <Skeleton className="h-3 w-full rounded-md motion-reduce:before:animate-none" />
        <Skeleton className="h-3 w-4/5 rounded-md motion-reduce:before:animate-none" />
      </div>
      <div className="space-y-2">{[0, 1, 2].map((line) => <Skeleton key={line} className="h-3 w-2/3 max-w-md rounded-md motion-reduce:before:animate-none" />)}</div>
      <div className="grid gap-4 sm:grid-cols-2 sm:max-w-xl">{[0, 1].map((field) => <div key={field} className="space-y-2"><Skeleton className="h-3 w-36 rounded-md motion-reduce:before:animate-none" /><Skeleton className="h-11 w-full rounded-xl motion-reduce:before:animate-none" /></div>)}</div>
      <div className="flex flex-wrap gap-3"><Skeleton className="h-10 w-48 rounded-xl motion-reduce:before:animate-none" /><Skeleton className="h-10 w-40 rounded-xl motion-reduce:before:animate-none" /></div>
      <div className="overflow-hidden rounded-xl border border-divider">
        <div className="grid grid-cols-4 gap-4 bg-content2 p-4">{[0, 1, 2, 3].map((cell) => <Skeleton key={cell} className="h-3 rounded-md motion-reduce:before:animate-none" />)}</div>
        {[0, 1, 2].map((row) => <div key={row} className="grid grid-cols-4 items-center gap-4 border-t border-divider p-4">{[0, 1, 2, 3].map((cell) => <Skeleton key={cell} className={`${cell === 0 ? 'h-4 w-3/4' : 'h-9 w-full'} rounded-lg motion-reduce:before:animate-none`} />)}</div>)}
      </div>
      <Skeleton className="h-10 w-40 rounded-xl motion-reduce:before:animate-none" />
    </Card>
  </div>;
}

export default function SubscriptionPlansPanel() {
  const confirm = useAdminConfirmation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Record<string, RegionPrice[]>>({});
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState<Record<string, boolean>>({});
  const [copySource, setCopySource] = useState<Record<string, string>>({});
  const [nextProductIds, setNextProductIds] = useState<Record<string, { android: string; ios: string }>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const failure = /could not|failed|check |enable |enter |add at least|positive|no higher|not confirm|status/i.test(message);
    addToast({ title: failure ? "Subscription settings" : "Subscription settings updated", description: message, severity: failure ? "danger" : "success", timeout: 5000, shouldShowTimeoutProgress: true });
  }, [message]);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    try {
      const token = window.localStorage.getItem("admin_token") || "";
      const response = await apiRequest<{ plans: Plan[] }>("/admin/subscription-plans", "GET", undefined, token);
      if (!isActive()) return;
      setPlans(response.plans);
      setRows(Object.fromEntries(response.plans.map((plan) => [plan.key, toRows(plan)])));
      setNextProductIds(Object.fromEntries(response.plans.map((plan) => [plan.key, { android: "", ios: "" }])));
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void load(() => active).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Could not load plans"); });
    return () => { active = false; };
  }, [load]);

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

  async function copyPrices(planKey: string) {
    const sourceCode = copySource[planKey];
    const targets = selected[planKey] ?? [];
    const source = rows[planKey]?.find((row) => row.regionCode === sourceCode);
    if (!source || !targets.length) return;
    if (!await confirm({ title: 'Copy market prices?', description: `Replace the prices in ${targets.length} selected market(s) with the amounts from ${sourceCode}? This only changes the form until you publish.`, confirmLabel: 'Copy prices', tone: 'warning' })) return;
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
    if (!await confirm({ title: `Publish to ${store === 'android' ? 'Google Play' : 'Apple App Store'}?`, description: `Publish the reviewed ${plan.key} prices for ${planRows.length} market(s) to this store? The existing store verification and price-version rules will apply.`, confirmLabel: 'Publish prices', tone: 'warning' })) return;
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
    <div className="w-full min-w-0 space-y-6" aria-busy={loading}>
      <header className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold tracking-tight">Subscription plans</h2><p className="mt-3 text-sm text-default-500">Market pricing, store availability and publishing in one place.</p></div><span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary">Monthly Pro subscription</span></header>
      <section aria-label="Pricing guidance" className="overflow-hidden rounded-2xl border border-divider bg-content1">
        <div className="grid divide-y divide-divider lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {[{ number: '01', title: 'Set your market prices', text: 'Set regular and offer prices by market. The discount is calculated automatically.' }, { number: '02', title: 'Review the customer price', text: 'The offer price is the target amount sent to the selected store; this app does not add GST on top. Customers see the final localized price returned by their store.' }, { number: '03', title: 'Publish to each store', text: 'Configure Google Play and Apple availability independently.' }].map(item => <div key={item.number} className="p-5 sm:p-6"><span className="mb-4 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-semibold text-primary">{item.number}</span><h2 className="!text-sm font-semibold">{item.title}</h2><p className="mt-2 text-xs leading-6 text-default-500">{item.text}</p></div>)}
        </div>
        <div className="flex items-start gap-3 border-t border-warning/15 bg-warning/[.04] px-5 py-4 sm:px-6"><svg aria-hidden="true" className="mt-0.5 shrink-0 text-warning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></svg><p className="text-xs leading-6 text-default-500"><span className="font-medium text-warning">India GST review. </span>Confirm how India GST should be reflected in the store price with finance or a tax professional before publishing.</p></div>
      </section>
      {loading && plans.length === 0 ? <PlansSkeleton /> : null}
      {!loading && plans.length === 0 ? <Card shadow="none" className="gap-3 border border-dashed border-divider bg-content1/50 p-6"><p className="text-sm text-default-500">{message ? 'Subscription plans could not be loaded.' : 'No subscription plans are available yet.'}</p><AdminButton className="self-start" onClick={() => { setMessage(""); void load().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load plans")); }}>Try again</AdminButton></Card> : null}
      <div className="grid min-w-0 grid-cols-1 gap-6">
        {plans.map((plan) => {
          const planRows = rows[plan.key] ?? [];
          const india = plan.regionalPricing?.find(row => row.regionCode === "IN");
          const indiaCurrency = india && new Intl.NumberFormat("en-IN", { style: "currency", currency: india.currencyCode, minimumFractionDigits: 0 });
          const publishIds = nextProductIds[plan.key] ?? { android: "", ios: "" };
          return <Card as="section" key={plan.key} shadow="none" className="min-w-0 w-full gap-6 overflow-visible rounded-2xl border border-divider bg-content1 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-default-500">Plan configuration</p><h2 className="mt-2 !text-xl font-semibold">Monthly plan</h2></div><span className="rounded-lg border border-divider bg-content2 px-3 py-2 text-xs text-default-500">Current price version <strong className="ml-1 text-foreground">{plan.priceVersion ?? 1}</strong></span></div>
            {india && indiaCurrency && <section aria-label="Saved India pricing" className="rounded-xl border border-primary/20 bg-primary/[.035] p-5">
              <h3 className="text-sm font-semibold">Saved India pricing</h3>
              <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
                <div><dt className="text-xs text-default-500">Regular price</dt><dd>{indiaCurrency.format(india.regularPrice)}</dd></div>
                <div><dt className="text-xs text-default-500">Recurring offer per month</dt><dd className="font-semibold text-primary">{indiaCurrency.format(india.offerPrice)}</dd></div>
              </dl>
            </section>}
            <div className="grid gap-4 md:grid-cols-2">
              {(['android', 'ios'] as const).map(store => <section key={store} aria-label={`${store === 'android' ? 'Google Play' : 'Apple App Store'} configuration`} className="min-w-0 rounded-xl border border-divider bg-background/40 p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${store === 'android' ? 'bg-emerald-400/10 text-emerald-700 dark:text-emerald-300' : 'bg-sky-400/10 text-sky-700 dark:text-sky-300'}`}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">{store === 'android' ? <path d="m6 3 15 9-15 9V3Z M6 3l10 14M6 21l10-14" /> : <><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M10 18h4" /></>}</svg></span><h3 className="text-sm font-semibold">{store === 'android' ? 'Google Play' : 'Apple App Store'}</h3></div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-default-500">Current product</p><p className="mt-1.5 break-all font-mono text-xs leading-5 text-default-600">{store === 'android' ? plan.storeProductIds?.android ?? plan.productId : plan.storeProductIds?.ios ?? 'Not configured'}</p>
                {store === "android" && <p className="mt-2 text-xs text-default-500">Base plan ID · <code>{plan.key}</code></p>}
                <p className="mb-5 mt-3 rounded-lg bg-content2/60 px-3 py-2 text-xs leading-5 text-default-500">{storeStatusLabel(plan, store)}</p>
                <label className="block text-xs font-medium text-default-600">New {store === 'android' ? 'Google Play' : 'Apple'} product ID<AdminInput aria-label={`New ${store === 'android' ? 'Google Play' : 'Apple'} product ID for ${plan.key}`} placeholder={store === 'android' ? 'Create in Google Play first' : 'Create in App Store Connect first'} value={nextProductIds[plan.key]?.[store] ?? ''} onChange={event => setNextProductIds(value => ({ ...value, [plan.key]: { ...(value[plan.key] ?? { android: '', ios: '' }), [store]: event.target.value } }))} className="mt-2 w-full" /></label>
              </section>)}
            </div>
            {(plan.priceVersionHistory ?? []).length > 0 && <details className="rounded-xl border border-divider bg-background/30 px-4 text-xs text-default-500"><summary className="cursor-pointer py-4 font-medium text-default-600">Archived price versions <span className="ml-2 text-default-500">({plan.priceVersionHistory!.length})</span></summary><ul className="space-y-3 pb-3">{[...(plan.priceVersionHistory ?? [])].reverse().map(version => <li key={version.version} className="rounded-lg bg-content2/50 p-3 leading-6"><strong className="text-foreground">Version {version.version}</strong> · {version.regionalPricing?.map(row => `${row.regionCode}: ${row.currencyCode} ${row.offerPrice}/mo`).join(', ') || `INR ${version.priceInr}`}<span className="block break-all">Google: {version.storeProductIds?.android ?? 'not set'} · Apple: {version.storeProductIds?.ios ?? 'not set'}</span><span className="text-default-500">Saved {new Date(version.publishedAt).toLocaleDateString()}</span></li>)}</ul><p className="border-t border-divider py-3 leading-6">Keep archived store products available for current subscribers to renew at their existing rate.</p></details>}
            <div className="border-t border-divider pt-6"><h3 className="text-sm font-semibold">Markets & pricing</h3><p className="mt-1 text-xs text-default-500">{planRows.length} markets configured · {(selected[plan.key] ?? []).length} selected for copying</p></div>
            <div className="grid items-end gap-3 rounded-xl border border-divider bg-background/30 p-4 md:grid-cols-[auto_1fr_auto]">
              <AdminButton type="button" onClick={() => setPickerOpen((value) => ({ ...value, [plan.key]: !value[plan.key] }))} variant="flat" className="h-11 w-full md:w-auto">{pickerOpen[plan.key] ? "Close country list" : `Add countries / regions (${planRows.length} selected)`}</AdminButton>
              <div className="min-w-0">
                <AdminSelect label="Copy prices from" value={copySource[plan.key] ?? ""} onChange={(event) => setCopySource((value) => ({ ...value, [plan.key]: event.target.value }))} className="w-full">
                  <option value="">Choose a market</option>{planRows.map((row) => <option key={row.regionCode} value={row.regionCode}>{byCode.get(row.regionCode)?.name ?? row.regionCode} ({row.currencyCode})</option>)}
                </AdminSelect>
              </div>
              <AdminButton type="button" disabled={!copySource[plan.key] || !(selected[plan.key]?.length)} onClick={() => copyPrices(plan.key)} variant="bordered" className="h-11 w-full border-divider md:w-auto">Copy to selected rows</AdminButton>
            </div>
            {pickerOpen[plan.key] && <div className="max-h-80 overflow-y-auto rounded-xl border border-divider bg-background/40 p-4">
              <AdminInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search country, region, or currency" aria-label="Search countries and regions" className="mb-3 w-full" />
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCountries.map((country) => <label key={country.code} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-default-600 hover:bg-content2">
                  <AdminInput type="checkbox" checked={planRows.some((row) => row.regionCode === country.code)} onChange={() => toggleCountry(plan.key, country.code)} />
                  <span>{country.name} <small className="text-default-500">· {country.code} · {country.currency}</small></span>
                </label>)}
              </div>
              {!visibleCountries.length && <p className="text-default-500">No matching country or region.</p>}
            </div>}
            {!planRows.length ? <p className="text-default-500">No markets selected yet.</p> : <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-divider">
              <Table aria-label="Regional subscription pricing" removeWrapper className="min-w-[860px]" classNames={{ th: "bg-content2 py-4 text-[10px] uppercase tracking-wide whitespace-nowrap", td: "border-b border-divider/50 py-4 last:border-0" }}>
                <TableHeader>{["Copy", "Market / currency", "Regular price", "Offer price", "Discount", "Google Play flag", "Apple App Store flag", "Actions"].map((heading) => <TableColumn key={heading} className="text-xs font-semibold text-default-500">{heading}</TableColumn>)}</TableHeader>
                <TableBody>{planRows.map((row) => <TableRow key={row.regionCode}>
                  <TableCell className="text-sm"><AdminInput type="checkbox" aria-label={`Select ${byCode.get(row.regionCode)?.name} as a copy target`} checked={(selected[plan.key] ?? []).includes(row.regionCode)} onChange={() => toggleTarget(plan.key, row.regionCode)} /></TableCell>
                  <TableCell className="text-sm"><strong>{byCode.get(row.regionCode)?.name ?? row.regionCode}</strong><br /><small className="text-default-500">{row.regionCode} · {row.currencyCode}</small></TableCell>
                  <TableCell className="text-sm"><AdminInput type="number" min="0.01" step="0.01" aria-label={`${row.regionCode} regular price (${row.currencyCode})`} value={row.regularPrice} onChange={(event) => updateRegion(plan.key, row.regionCode, "regularPrice", event.target.value)} style={inputStyle} /></TableCell>
                  <TableCell className="text-sm"><AdminInput type="number" min="0.01" step="0.01" aria-label={`${row.regionCode} offer price (${row.currencyCode})`} value={row.offerPrice} onChange={(event) => updateRegion(plan.key, row.regionCode, "offerPrice", event.target.value)} style={inputStyle} /></TableCell>
                  <TableCell className="text-sm"><span className="inline-flex rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold tabular-nums text-primary">{discount(row)}</span></TableCell>
                  <TableCell className="text-sm"><label className="flex items-center gap-2 text-xs"><AdminInput type="checkbox" aria-label={`Google Play availability for ${row.regionCode}`} checked={row.googlePlayAvailable} onChange={(event) => updateRegion(plan.key, row.regionCode, "googlePlayAvailable", event.target.checked)} /> Enabled</label></TableCell>
                  <TableCell className="text-sm"><label className="flex items-center gap-2 text-xs"><AdminInput type="checkbox" aria-label={`Apple App Store availability for ${row.regionCode}`} checked={row.appleAppStoreAvailable} onChange={(event) => updateRegion(plan.key, row.regionCode, "appleAppStoreAvailable", event.target.checked)} /> Enabled</label></TableCell>
                  <TableCell className="text-sm"><AdminButton type="button" onClick={async () => { if (await confirm({ title: 'Remove market?', description: `Remove ${byCode.get(row.regionCode)?.name ?? row.regionCode} from this plan’s selected markets? Publish to apply the change.`, confirmLabel: 'Remove market', tone: 'warning' })) toggleCountry(plan.key, row.regionCode); }} style={{ ...buttonStyle, padding: "6px 9px" }}>Remove</AdminButton></TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/[.04] p-4 sm:p-5"><div className="max-w-2xl"><p className="text-sm font-medium">Ready to review?</p><p className="mt-1.5 text-xs leading-6 text-default-500">Review the price preview before publishing. Each store is updated separately, and only a store-confirmed price version becomes available to that store’s new subscribers.</p></div><AdminButton type="button" color="primary" disabled={Boolean(saving) || !planRows.length} onClick={() => setPreviewPlan(plan.key)} className="w-full shrink-0 rounded-xl px-6 sm:w-auto">Preview & publish <span aria-hidden="true">↗</span></AdminButton></div>
            {previewPlan === plan.key && <AdminModal aria-labelledby={`preview-title-${plan.key}`} isOpen size="5xl" scrollBehavior="inside" isDismissable={false} isKeyboardDismissDisabled={Boolean(saving)} hideCloseButton={Boolean(saving)} onClose={() => setPreviewPlan(null)} backdrop="blur" classNames={{ base: 'admin-ui border border-divider bg-content1 text-foreground' }}>
              <ModalContent><ModalHeader id={`preview-title-${plan.key}`}>Review {plan.key} subscription prices</ModalHeader><ModalBody className="gap-5 pb-6">
                <p className="rounded-xl border border-divider bg-content2/40 p-4 text-xs leading-6 text-default-500">Compare the target regular and offer prices by market. Publishing sends the offer amount to that store and verifies it. HappiNotes does not add tax after the store price; confirm India GST treatment with finance or a tax professional. Customers see the store’s final localized checkout price.</p>
                <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-divider"><Table aria-label="Subscription price preview" removeWrapper className="min-w-[560px]"><TableHeader>{["Country", "Currency", "Regular", "Offer", "Discount", "Google Play", "Apple"].map((h) => <TableColumn key={h} className="text-xs font-semibold text-default-500">{h}</TableColumn>)}</TableHeader><TableBody>{planRows.map((row) => <TableRow key={row.regionCode}><TableCell className="text-sm">{byCode.get(row.regionCode)?.name ?? row.regionCode}</TableCell><TableCell className="text-sm">{row.currencyCode}</TableCell><TableCell className="text-sm">{row.regularPrice}</TableCell><TableCell className="text-sm">{row.offerPrice}</TableCell><TableCell className="text-sm"><span className="inline-flex rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold tabular-nums text-primary">{discount(row)}</span></TableCell><TableCell className="text-sm">{row.googlePlayAvailable ? "Selected" : "Off"}</TableCell><TableCell className="text-sm">{row.appleAppStoreAvailable ? "Selected" : "Off"}</TableCell></TableRow>)}</TableBody></Table></div>
                <div className="grid gap-3 sm:grid-cols-2">{(['android', 'ios'] as const).map(store => <div key={store} className="min-w-0 rounded-xl border border-divider bg-content2/30 p-4"><p className="mb-2 text-xs font-semibold">{store === 'android' ? 'Google Play' : 'Apple App Store'}</p><p className="break-all font-mono text-xs leading-5 text-default-500">{publishIds[store].trim() || plan.storeProductIds?.[store] || (store === 'android' ? plan.productId : 'Not configured')}</p><p className="mt-2 text-xs leading-5 text-default-500">{storeStatusLabel(plan, store)}</p></div>)}</div>
                <div className="flex flex-wrap justify-end gap-3 border-t border-divider pt-4">
                  <AdminButton type="button" disabled={Boolean(saving)} onClick={() => void publishStore(plan, "android")} color="primary" className="w-full sm:w-auto">{saving === `${plan.key}:android` ? "Publishing to Google Play..." : "Publish to Google Play"}</AdminButton>
                  <AdminButton type="button" disabled={Boolean(saving)} onClick={() => void publishStore(plan, "ios")} variant="bordered" className="w-full border-divider sm:w-auto">{saving === `${plan.key}:ios` ? "Publishing to Apple..." : "Publish to Apple App Store"}</AdminButton>
                  <AdminButton type="button" disabled={Boolean(saving)} onClick={() => setPreviewPlan(null)} variant="flat" className="w-full sm:w-auto">Close</AdminButton>
                </div>
              </ModalBody></ModalContent>
            </AdminModal>}
          </Card>;
        })}
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = { padding: "9px 12px", borderRadius: 8, border: "1px solid hsl(var(--heroui-divider))", background: "hsl(var(--heroui-content2))", color: "var(--foreground)", cursor: "pointer" };
const inputStyle: React.CSSProperties = { width: 116, border: "1px solid hsl(var(--heroui-divider))", borderRadius: 8, background: "hsl(var(--heroui-content1))", color: "var(--foreground)", padding: "8px 10px" };
