"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type DeletionRequest = {
  id: string;
  reference: string;
  status: "REQUEST_RECEIVED" | "UNDER_REVIEW" | "COMPLETED";
  internalStatus: string;
  reviewStatus: string;
  source: string;
  requestedAt: string;
  completedAt: string | null;
  account: { name: string; email: string; phoneNumber: string } | null;
  history: Array<{ status: string; actor: string; at: string }>;
};

export default function DeletionRequestsPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const token = window.localStorage.getItem("admin_token") || "";
    const result = await apiRequest<{ requests: DeletionRequest[] }>("/admin/account-deletions", "GET", undefined, token);
    setRequests(result.requests);
  }, []);

  useEffect(() => { void load().catch(() => setMessage("Could not load deletion requests.")); }, [load]);

  async function markUnderReview(id: string) {
    setBusy(id); setMessage("");
    try {
      const token = window.localStorage.getItem("admin_token") || "";
      await apiRequest(`/admin/account-deletions/${id}/review`, "PATCH", {}, token);
      setMessage("Request marked under review. This does not mark deletion complete.");
      await load();
    } catch { setMessage("Could not update this request."); }
    finally { setBusy(""); }
  }

  return <section style={{ maxWidth: 1100, margin: "0 auto", color: "#eee" }}>
    <h1 style={{ fontSize: 28, marginBottom: 8 }}>Account deletion requests</h1>
    <p style={{ color: "#aaa", lineHeight: 1.6 }}>Review requests from the app and public form. Purchase and transaction records are retained pending an approved retention policy. This admin screen cannot mark a request completed.</p>
    {message && <p role="status" style={{ padding: 12, background: "#201b10", borderRadius: 8 }}>{message}</p>}
    <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
      {requests.map((request) => <article key={request.id} style={{ padding: 18, border: "1px solid #292933", borderRadius: 12, background: "#101015" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
          <div><h2 style={{ margin: 0, fontSize: 18 }}>{request.reference}</h2><p style={{ margin: "6px 0", color: "#aaa" }}>{request.status.replaceAll("_", " ")} · {request.source.replaceAll("_", " ")} · {new Date(request.requestedAt).toLocaleString()}</p></div>
          {request.status !== "COMPLETED" && <button type="button" disabled={busy === request.id} onClick={() => void markUnderReview(request.id)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #514339", background: "#211b17", color: "#f2c6ad", cursor: "pointer" }}>{busy === request.id ? "Saving…" : "Mark under review"}</button>}
        </div>
        <p style={{ color: "#ccc" }}>Account: {request.account?.name || "Unavailable"} · {request.account?.email || request.account?.phoneNumber || "No contact on record"}</p>
        <p style={{ color: "#888", fontSize: 12 }}>Internal workflow: {request.internalStatus} · review flag: {request.reviewStatus}</p>
        <details><summary>Processing history ({request.history.length})</summary><ol>{request.history.map((entry, index) => <li key={`${request.id}-${index}`}>{entry.status} — {entry.actor} — {new Date(entry.at).toLocaleString()}</li>)}</ol></details>
        {request.internalStatus === "blocked_policy" && <p style={{ color: "#f0c38b" }}>Paused at the retention-policy gate. Owner/legal approval and a backend implementation are required before processing can continue.</p>}
      </article>)}
      {requests.length === 0 && <p style={{ color: "#aaa" }}>No deletion requests recorded.</p>}
    </div>
  </section>;
}
