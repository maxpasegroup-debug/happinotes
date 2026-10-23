import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Account deletion | HappiNotes",
  description: "How to request deletion of a HappiNotes account.",
};

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

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
        .deletion-contact--missing{display:block;background:#f3ecdf;color:#66655f;font-weight:500}
        .deletion-footer{margin-top:26px;color:#77736b;font-size:12px;line-height:1.6}
        @media (prefers-reduced-motion:reduce){.deletion-page *{transition:none!important}}
      `}</style>

      <div className="deletion-shell">
        <Link className="deletion-brand" href="/" aria-label="HappiNotes home">
          <span className="deletion-mark" aria-hidden="true">H</span>
          <span>happinotes</span>
        </Link>

        <article className="deletion-card">
          <p className="deletion-eyebrow">Privacy and account control</p>
          <h1 className="deletion-title">Request account deletion</h1>
          <p className="deletion-lede">
            HappiNotes account deletion is started from the signed-in mobile app so we can verify account ownership without asking you to send a password or PIN on a public page.
          </p>

          <section className="deletion-section" aria-labelledby="steps-heading">
            <h2 id="steps-heading">How to request it</h2>
            <ol>
              <li>Open HappiNotes and go to Profile or Settings.</li>
              <li>Select <strong>Delete account</strong> and review the consequences.</li>
              <li>Complete the password or PIN reauthentication, then confirm the request.</li>
              <li>Use the in-app status screen to see whether the request is received, processing, paused for policy review, or completed.</li>
            </ol>
            <div className="deletion-note">
              If you cannot sign in, this public page does not collect credentials and there is not yet a separate unauthenticated web-deletion request endpoint in the backend. Contact support using the approved address below instead.
            </div>
          </section>

          <section className="deletion-section" aria-labelledby="data-heading">
            <h2 id="data-heading">What happens next</h2>
            <p>
              The authenticated request immediately protects the account while the backend processes approved deletion stages. The app does not report completion while processing is incomplete or paused. We do not publish a completion time here; the current status is shown in the app and support can explain a manual-review state.
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
            {supportEmail ? (
              <>
                <p>For an inaccessible account or a request that needs manual review, contact HappiNotes support. Do not include a password, PIN, OTP, or purchase token.</p>
                <a className="deletion-contact" href={`mailto:${supportEmail}`}>Contact HappiNotes support</a>
              </>
            ) : (
              <p className="deletion-contact deletion-contact--missing">
                The public support address is not configured in this build. Before publishing this page, the owner must set <code>NEXT_PUBLIC_SUPPORT_EMAIL</code> to an approved, verified support address.
              </p>
            )}
          </section>

          <p className="deletion-footer">
            This page is an account-deletion information resource. It does not expose the authenticated deletion API and does not itself confirm that an account has been deleted.
          </p>
        </article>
      </div>
    </main>
  );
}
