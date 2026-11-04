"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api";

type CreatedRequest = { reference: string; status: string; requestedAt: string; statusToken: string };
type PublicStatus = { reference: string; status: "REQUEST_RECEIVED" | "UNDER_REVIEW" | "COMPLETED"; requestedAt: string; completedAt: string | null; history: Array<{ status: string; at: string }> };

const statusCopy: Record<string, { title: string; message: string }> = {
  REQUEST_RECEIVED: { title: "REQUEST RECEIVED", message: "Your email was verified and your request was recorded. The backend has not confirmed deletion." },
  UNDER_REVIEW: { title: "UNDER REVIEW", message: "The request is being reviewed. This does not mean account deletion is complete." },
  COMPLETED: { title: "COMPLETED", message: "The backend has confirmed that the deletion workflow completed." },
};

export default function AccountDeletionForm() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"email" | "verify" | "tracking">("email");
  const [request, setRequest] = useState<CreatedRequest | null>(null);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = window.sessionStorage.getItem("happinotes-deletion-tracking");
    if (!saved) return;
    try {
      const restored = JSON.parse(saved) as CreatedRequest;
      if (restored.reference && restored.statusToken) {
        setRequest(restored); setStatus({ reference: restored.reference, status: restored.status as PublicStatus["status"], requestedAt: restored.requestedAt, completedAt: null, history: [] }); setPhase("tracking");
      }
    } catch { window.sessionStorage.removeItem("happinotes-deletion-tracking"); }
  }, []);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await apiRequest("/account-deletion/request-otp", "POST", { email });
      setPhase("verify");
      setMessage("If this email is connected to an eligible HappiNotes account, a verification code will arrive shortly.");
    } catch {
      setMessage("We could not send the code just now. Please try again later or contact support.");
    } finally { setBusy(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await apiRequest<CreatedRequest & { success: boolean }>("/account-deletion/verify-otp", "POST", { email, otp });
      setRequest(result); setPhase("tracking");
      window.sessionStorage.setItem("happinotes-deletion-tracking", JSON.stringify(result));
      setStatus({ reference: result.reference, status: result.status as PublicStatus["status"], requestedAt: result.requestedAt, completedAt: null, history: [] });
      setMessage("Email verified. Save the reference and private status code below to check progress later.");
    } catch {
      setMessage("That code is invalid or expired. Request a new code and try again.");
    } finally { setBusy(false); }
  }

  async function refreshStatus() {
    if (!request) return;
    setBusy(true); setMessage("");
    try {
      const result = await apiRequest<PublicStatus>("/account-deletion/status", "POST", { reference: request.reference, statusToken: request.statusToken });
      setStatus(result); setMessage("Status updated from the deletion request record.");
    } catch {
      setMessage("We could not verify that reference and status code. Contact support if you have lost the code.");
    } finally { setBusy(false); }
  }

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`); }
    catch { setMessage(`Copy unavailable. Select and copy the ${label.toLowerCase()} manually.`); }
  }

  return <section className="deletion-section" aria-labelledby="external-request-heading">
    <h2 id="external-request-heading">Submit a request online</h2>
    <p>Enter the email address registered to your account. We verify that you control that inbox before accepting a request. We do not support phone-only account verification through this form; use the signed-in app or contact support.</p>
    {phase === "email" && <form className="deletion-form" onSubmit={sendCode}>
      <label htmlFor="deletion-email">Registered account email</label>
      <input id="deletion-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <button className="deletion-contact" type="submit" disabled={busy}>{busy ? "Sending…" : "Send verification code"}</button>
    </form>}
    {phase === "verify" && <form className="deletion-form" onSubmit={verifyCode}>
      <label htmlFor="deletion-otp">Six-digit code</label>
      <input id="deletion-otp" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} />
      <button className="deletion-contact" type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and submit request"}</button>
      <button type="button" className="deletion-secondary" disabled={busy} onClick={() => { setPhase("email"); setOtp(""); }}>Use another email</button>
    </form>}
    {phase === "tracking" && request && <div className="deletion-tracking">
      <div><strong>Request reference</strong><code>{request.reference}</code><button type="button" onClick={() => void copy(request.reference, "Reference")}>Copy</button></div>
      <div><strong>Private status code</strong><code>{request.statusToken}</code><button type="button" onClick={() => void copy(request.statusToken, "Status code")}>Copy</button></div>
      <p>Keep the status code private. It is required with your reference to view request progress from this page.</p>
      {status && <div className="deletion-status"><strong>{statusCopy[status.status]?.title ?? "UNDER REVIEW"}</strong><p>{statusCopy[status.status]?.message ?? "The request is not marked complete."}</p><small>Received: {new Date(status.requestedAt).toLocaleString()}</small>{status.completedAt && <small>Completed: {new Date(status.completedAt).toLocaleString()}</small>}</div>}
      <button className="deletion-contact" type="button" disabled={busy} onClick={() => void refreshStatus()}>{busy ? "Checking…" : "Refresh request status"}</button>
      <button className="deletion-secondary" type="button" onClick={() => { window.sessionStorage.removeItem("happinotes-deletion-tracking"); setPhase("email"); setRequest(null); setStatus(null); setOtp(""); setMessage(""); }}>Verify email again / recover request details</button>
    </div>}
    {message && <p className="deletion-form-message" role="status">{message}</p>}
  </section>;
}
