"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type Plan = { key: "monthly" | "yearly"; productId: string; priceInr: number; billingPeriod: string };
type SavePlanResponse = { success: boolean; plan: Plan; googlePlaySync?: "synced" | "failed"; warning?: string };

export default function AdminSettingsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const token = window.localStorage.getItem("admin_token") || "";
    const response = await apiRequest<{ plans: Plan[] }>("/admin/subscription-plans", "GET", undefined, token);
    setPlans(response.plans);
    setValues(Object.fromEntries(response.plans.map((plan) => [plan.key, String(plan.priceInr ?? "")] )));
  }

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load plans")); }, []);

  async function save(key: Plan["key"]) {
    const token = window.localStorage.getItem("admin_token") || "";
    setSaving(key); setMessage("");
    try {
      const response = await apiRequest<SavePlanResponse>(`/admin/subscription-plans/${key}`, "PATCH", { priceInr: Number(values[key]) }, token);
      const label = key === "monthly" ? "Monthly" : "Yearly";
      setMessage(response.googlePlaySync === "failed"
        ? `${label} price saved. Google Play sync warning: ${response.warning ?? "retry synchronization before accepting purchases."}`
        : `${label} plan updated.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save plan"); }
    finally { setSaving(null); }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ marginTop: 0 }}>Subscription plans</h1>
      <p style={{ color: "#a1a1aa" }}>
        Premium stories use a subscription. Set the monthly and yearly prices here; books do not have individual prices. Saving also syncs the Google Play subscription product.
      </p>
      <div style={{ display: "grid", gap: 14 }}>
        {plans.map((plan) => (
          <div key={plan.key} style={{ border: "1px solid #232329", borderRadius: 12, padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>{plan.key === "monthly" ? "Monthly plan" : "Yearly plan"}</h2>
            <p style={{ color: "#a1a1aa", fontSize: 13 }}>Store product: {plan.productId}</p>
            <label style={{ display: "grid", gap: 6, maxWidth: 300 }}>
              Price (INR)
              <input
                value={values[plan.key] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [plan.key]: event.target.value.replace(/[^0-9.]/g, "") }))}
                type="number" min="0" step="0.01"
                style={{ border: "1px solid #3a3a45", borderRadius: 8, background: "#12131a", color: "white", padding: "10px 12px" }}
              />
            </label>
            <button type="button" disabled={saving === plan.key} onClick={() => void save(plan.key)} style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, border: 0, background: "#f97316", color: "white", cursor: "pointer" }}>
              {saving === plan.key ? "Saving..." : "Save price"}
            </button>
          </div>
        ))}
      </div>
      {message ? <p style={{ marginTop: 16, color: "#a1a1aa" }}>{message}</p> : null}
    </div>
  );
}
