import Link from "next/link";
import { MobileShell } from "@/components/mobile-shell";

export default function SubscribeSuccessPage() {
  return (
    <MobileShell>
      <section className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-5">
        <h1 className="text-2xl font-semibold text-emerald-200">Payment successful</h1>
        <p className="mt-2 text-sm text-emerald-100">
          Your subscription has been activated. Premium lifebooks are now unlocked.
        </p>
      </section>

      <div className="mt-4 flex gap-2">
        <Link
          href="/"
          className="rounded-xl bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-4 py-2 text-sm font-semibold text-[#211100]"
        >
          Go to Lifebooks
        </Link>
        <Link href="/profile" className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white">
          Open Profile
        </Link>
      </div>
    </MobileShell>
  );
}
