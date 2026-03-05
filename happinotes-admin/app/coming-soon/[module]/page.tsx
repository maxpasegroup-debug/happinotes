import Link from "next/link";
import { MobileShell } from "@/components/mobile-shell";

const labels: Record<string, string> = {
  notes: "Notes",
  happiness: "Happiness",
  lifebooks: "Lifebooks",
};

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const moduleName = labels[module] || "Module";

  return (
    <MobileShell>
      <section className="mt-12 rounded-2xl border border-white/10 bg-[#141a2a] p-8 text-center">
        <h1 className="text-2xl font-bold text-white">Coming Soon</h1>
        <p className="mt-3 text-sm text-[#b7c0d8]">
          {moduleName} - This module will be available soon.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-5 py-2 text-sm font-semibold text-[#211100]"
        >
          Back to Lifebooks
        </Link>
      </section>
    </MobileShell>
  );
}
