"use client";

import { useAdminConfirmation } from "@/components/admin/ConfirmationProvider";

import { AdminButton } from "@/components/admin/ui";

import { Card, CardBody, Chip, Divider, Spinner } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
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
  const confirm = useAdminConfirmation();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [live, setLive] = useState(false);
  const refreshInFlight = useRef(false);
  const refreshQueued = useRef(false);
  const mounted = useRef(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (refreshInFlight.current) { refreshQueued.current = true; return; }
    refreshInFlight.current = true;
    try {
      do {
        refreshQueued.current = false;
        const token = window.localStorage.getItem("admin_token") || "";
        const result = await apiRequest<{ requests: DeletionRequest[] }>("/admin/account-deletions", "GET", undefined, token);
        if (!mounted.current) return;
        setRequests(result.requests);
        setLoadError("");
      } while (refreshQueued.current && mounted.current);
    } catch {
      if (mounted.current) setLoadError("Could not refresh deletion requests. Retrying automatically.");
    } finally {
      refreshInFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://happinotes-production-6b44.up.railway.app").replace(/\/+$/, "");
    const socket = io(`${apiBase}/admin`, {
      transports: ["websocket", "polling"],
      auth: (callback) => callback({ token: window.localStorage.getItem("admin_token") || "" }),
    });
    const refresh = () => { void load(); };
    const connected = () => { setLive(true); refresh(); };
    const disconnected = () => setLive(false);
    socket.on("connect", connected);
    socket.on("disconnect", disconnected);
    socket.on("connect_error", disconnected);
    socket.on("account-deletions:changed", refresh);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    // Reconcile missed events, unavailable sockets, and other backend replicas.
    const interval = window.setInterval(onVisible, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    refresh();
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      socket.disconnect();
    };
  }, [load]);

  async function markUnderReview(id: string) {
    if (!await confirm({ title: 'Mark request under review?', description: 'Update this request to under review? This does not complete account deletion.', confirmLabel: 'Mark under review', tone: 'warning' })) return;
    setBusy(id); setMessage("");
    try {
      const token = window.localStorage.getItem("admin_token") || "";
      await apiRequest(`/admin/account-deletions/${id}/review`, "PATCH", {}, token);
      setMessage("Request marked under review. This does not mark deletion complete.");
      await load();
    } catch { setMessage("Could not update this request."); }
    finally { setBusy(""); }
  }

  return <section className="mx-auto max-w-6xl space-y-6">
    <header><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-primary">Account management</p><h1>Account deletion requests</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-default-400">Review requests from the app and public form. Purchase and transaction records are retained pending an approved retention policy. This admin screen cannot mark a request completed.</p></header>
    <div className="flex items-center justify-between gap-3"><Chip size="sm" variant="flat" color={live ? "success" : "default"}>{live ? "Live updates" : "Auto-refresh · every 15 seconds"}</Chip><AdminButton size="sm" variant="flat" onClick={() => void load()}>Refresh</AdminButton></div>
    {loadError && <div role="alert" className="rounded-2xl bg-danger/10 p-4 text-sm text-danger">{loadError}</div>}
    {message && <div role="status" className="rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning-200">{message}</div>}
    <div className="grid gap-5">
      {requests.map((request) => <Card as="article" key={request.id} shadow="sm" className="border border-divider bg-content1"><CardBody className="gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex flex-wrap items-center gap-3"><h2>{request.reference}</h2><Chip size="sm" variant="flat" color={request.status === 'COMPLETED' ? 'success' : request.status === 'UNDER_REVIEW' ? 'warning' : 'primary'}>{request.status.replaceAll("_", " ")}</Chip></div><p className="mt-2 text-xs text-default-400">{request.source.replaceAll("_", " ")} · {new Date(request.requestedAt).toLocaleString()}</p></div>
          {request.status !== "COMPLETED" && <AdminButton type="button" color="primary" disabled={busy === request.id} isLoading={busy === request.id} onClick={() => void markUnderReview(request.id)}>{busy === request.id ? "Saving…" : "Mark under review"}</AdminButton>}
        </div>
        <Divider />
        <div><p className="text-sm">Account: {request.account?.name || "Unavailable"} · {request.account?.email || request.account?.phoneNumber || "No contact on record"}</p><p className="mt-2 text-xs text-default-400">Internal workflow: {request.internalStatus} · review flag: {request.reviewStatus}</p></div>
        <details className="rounded-xl bg-content2/50 px-4"><summary>Processing history ({request.history.length})</summary><ol className="pb-4 text-default-400">{request.history.map((entry, index) => <li key={`${request.id}-${index}`}>{entry.status} — {entry.actor} — {new Date(entry.at).toLocaleString()}</li>)}</ol></details>
        {request.internalStatus === "blocked_policy" && <p className="rounded-xl bg-warning/10 p-3 text-sm leading-6 text-warning-200">Paused at the retention-policy gate. Owner/legal approval and a backend implementation are required before processing can continue.</p>}
      </CardBody></Card>)}
      {loading && <div className="flex justify-center py-12"><Spinner label="Loading deletion requests…" /></div>}
      {!loading && !loadError && requests.length === 0 && <Card shadow="none" className="border border-dashed border-divider bg-content1"><CardBody className="p-12 text-center"><p className="font-medium">No deletion requests recorded.</p><p className="mt-2 text-sm text-default-400">Requests from the app and public form will appear here.</p></CardBody></Card>}
    </div>
  </section>;
}
