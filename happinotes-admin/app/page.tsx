import { MobileShell } from "@/components/mobile-shell";
import { getLiveLifebooks } from "@/lib/content-api";
import { DashboardClient } from "@/components/dashboard-client";
import { DesktopDashboardClient } from "@/components/desktop-dashboard-client";

export const revalidate = 30;

export default async function HomePage() {
  const lifebooks = await getLiveLifebooks();
  return (
    <>
      <div className="lg:hidden">
        <MobileShell>
          <DashboardClient initialLifebooks={lifebooks} />
        </MobileShell>
      </div>
      <div className="hidden lg:block">
        <DesktopDashboardClient initialLifebooks={lifebooks} />
      </div>
    </>
  );
}
