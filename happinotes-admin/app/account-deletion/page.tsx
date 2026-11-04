import type { Metadata } from "next";
import Link from "next/link";
import AccountDeletionForm from "./account-deletion-form";

export const metadata: Metadata = {
  title: "Account deletion | HappiNotes",
  description: "How to request deletion of a HappiNotes account.",
};

export default function AccountDeletionPage() {
  return (
    <main className="deletion-page">
      <style>{`
        .deletion-page{min-height:100vh;background:#fbf7ef;color:#1e232b;padding:32px 18px 64px;font-family:ui-sans-serif,system-ui,sans-serif}
        .deletion-shell{width:min(760px,100%);margin:0 auto}
        .deletion-brand{display:inline-flex;align-items:center;gap:10px;color:#1e232b;text-decoration:none;font-weight:750;letter-spacing:-.03em}
        .deletion-mark{display:grid;width:32px;height:32px;place-items:center;border-radius:11px 11px 11px 4px;background:#f36d52;color:#fff8eb;font-family:Georgia,serif;font-size:20px;box-shadow:4px 4px #1e232b18}
        .deletion-card{margin-top:42px;padding:clamp(26px,6vw,58px);border:1px solid #1e232b20;border-radius:8px 34px;background:#fffdf8;box-shadow:0 18px 45px #1e232b12}
        .deletion-eyebrow{margin:0 0 14px;color:#b84332;font-size:11px;font-weight:750;letter-spacing:.17em;text-transform:uppercase}
        .deletion-title{margin:0;max-width:620px;font-family:Georgia,'Times New Roman',serif;font-size:clamp(36px,7vw,64px);font-weight:500;letter-spacing:-.06em;line-height:.98}
        .deletion-lede{margin:22px 0 0;color:#66655f;font-size:16px;line-height:1.65}
        .deletion-section{padding-top:32px;border-top:1px solid #1e232b18;margin-top:32px}
        .deletion-section h2{margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;letter-spacing:-.04em}
        .deletion-section p,.deletion-section li{color:#66655f;font-size:14px;line-height:1.7}
        .deletion-section ol{padding-left:23px;margin:0}
        .deletion-section li+li{margin-top:8px}
        .deletion-note{margin-top:18px;padding:15px 16px;border-left:3px solid #f36d52;background:#f8eee5;color:#55534e;font-size:13px;line-height:1.6}
        .deletion-contact{display:inline-flex;align-items:center;min-height:44px;margin-top:7px;padding:11px 16px;border-radius:7px;background:#f36d52;color:#1e232b;text-decoration:none;font-size:14px;font-weight:750}
        .deletion-contact:hover{background:#b84332;color:#fff8eb}
        .deletion-footer{margin-top:26px;color:#77736b;font-size:12px;line-height:1.6}
        .deletion-form{display:grid;gap:10px;max-width:480px}.deletion-form label{font-size:13px;font-weight:700}.deletion-form input{min-height:46px;padding:10px 12px;border:1px solid #1e232b45;border-radius:7px;background:#fff;color:#1e232b;font:inherit}.deletion-form button:disabled,.deletion-tracking button:disabled{opacity:.6;cursor:wait}.deletion-secondary{display:inline-flex;min-height:40px;margin:8px 8px 0 0;padding:9px 12px;border:1px solid #1e232b35;border-radius:7px;background:transparent;color:#1e232b;cursor:pointer}.deletion-form-message{margin-top:18px;color:#55534e;font-size:13px;line-height:1.6}.deletion-tracking{display:grid;gap:12px}.deletion-tracking>div:not(.deletion-status){display:grid;gap:6px;padding:12px;background:#f8eee5}.deletion-tracking code{overflow-wrap:anywhere;font-size:12px}.deletion-tracking button:not(.deletion-contact):not(.deletion-secondary){justify-self:start;border:0;background:transparent;color:#a83e30;text-decoration:underline;cursor:pointer}.deletion-status{padding:16px;border:1px solid #1e232b20;border-radius:8px;background:#f8eee5}.deletion-status strong{color:#8d3529;font-size:13px;letter-spacing:.08em}.deletion-status p{font-size:14px;line-height:1.6}.deletion-status small{display:block;margin-top:6px;color:#66655f}
        @media (prefers-reduced-motion:reduce){.deletion-page *{transition:none!important}}
      `}</style>

      <div className="deletion-shell">
        <Link className="deletion-brand" href="/" aria-label="HappiNotes home">
          <span className="deletion-mark" aria-hidden="true">H</span>
          <span>happinotes</span>
        </Link>

        <article className="deletion-card">
          <p className="deletion-lede">HappiNotes is owned and operated by <strong>AIRASKILL CITY PRIVATE LIMITED</strong>.</p>
          <p className="deletion-lede">Registered office: 2619, T2, 6th Floor, HiLITE Business Park, HiLITE City, near Guruvayurappan College, Kozhikode – 673014, Kerala, India.<br />Customer support and privacy: <a href="mailto:hello@happinotes.online">hello@happinotes.online</a> · <a href="tel:+918089239823">+91 8089239823</a>.</p>
          <p className="deletion-eyebrow">Draft — deletion process needs owner and legal approval</p>
          <p className="deletion-eyebrow">Privacy and account control</p>
          <h1 className="deletion-title">Request account deletion</h1>
          <p className="deletion-lede">
            Submit a request here using your registered account email, or use the Delete account option in the signed-in app. This page never asks for your password or PIN.
          </p>

          <AccountDeletionForm />

          <section className="deletion-section" aria-labelledby="steps-heading">
            <h2 id="steps-heading">How to request it</h2>
            <ol>
              <li>Open HappiNotes and go to Profile or Settings.</li>
              <li>Select <strong>Delete account</strong> and review the consequences.</li>
              <li>Complete the password or PIN reauthentication, then confirm the request.</li>
              <li>Use the in-app status screen to see whether the request is received, processing, paused for policy review, or completed.</li>
            </ol>
            <div className="deletion-note">
              The online form verifies control of the registered email using a one-time code that expires after five minutes and allows up to five verification attempts. After verification, you receive a unique request reference and private status code. The status code is a bearer credential; save it privately. It remains in this browser tab session so you can refresh status. If you lose the details, verify the same email again to retrieve the active request. Phone-only accounts must use the signed-in app; an external verification flow for those accounts is not implemented. Contact support for assistance, but an email/phone contact is not itself a tracked deletion request. Do not send passwords, PINs, purchase tokens or OTPs to support.
            </div>
          </section>

          <section className="deletion-section" aria-labelledby="data-heading">
            <h2 id="data-heading">What happens next</h2>
            <p>
              A verified web request uses the same account deletion request record and worker as the signed-in app flow. The backend stores the reference, request date, status, and processing history. REQUEST RECEIVED means the verified request was recorded. UNDER REVIEW means worker/admin review is in progress; it is not completion. The current worker pauses before deleting identity and purchase records because the retention policy is awaiting approval. Only a backend record marked completed can be shown as COMPLETED. No completion time is promised.
            </p>
          </section>

          <section className="deletion-section" aria-labelledby="billing-heading">
            <h2 id="billing-heading">Store subscriptions are separate</h2>
            <p>
              Deleting a HappiNotes account does not cancel a Google Play or Apple App Store subscription. Open the subscription settings in the relevant store and cancel there if you do not want future renewals. Account deletion must not be treated as store cancellation.
            </p>
          </section>

          <section className="deletion-section" aria-labelledby="support-heading">
            <h2 id="support-heading">Need help?</h2>
            <p>For help or if you lose your status code, contact HappiNotes support. Do not include a password, PIN, OTP, or purchase token.</p>
            <a className="deletion-contact" href="mailto:hello@happinotes.online">Contact HappiNotes support</a>
          </section>

          <p className="deletion-footer">
            The external form submits a verified deletion request. This page does not itself perform data deletion and does not confirm completion without a completed backend status.
          </p>
          <p className="deletion-footer">
            <Link href="/privacy-policy">Privacy Policy</Link> · <Link href="/terms">Terms</Link> · <Link href="/subscription-policy">Subscription Policy</Link>
          </p>
        </article>
      </div>
    </main>
  );
}
