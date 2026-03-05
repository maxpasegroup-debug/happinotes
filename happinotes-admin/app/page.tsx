import { MobileShell } from "@/components/mobile-shell";
import { getLiveLifebooks } from "@/lib/content-api";
import { DashboardClient } from "@/components/dashboard-client";

export const revalidate = 30;

export default async function HomePage() {
  const lifebooks = await getLiveLifebooks();
  return (
    <MobileShell>
      <DashboardClient initialLifebooks={lifebooks} />
    </MobileShell>
  );
}
