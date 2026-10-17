import type { ReactNode } from "react";
import { Sidebar } from "@/components/app/sidebar";
import { NAV_FOOTER, NAV_GROUPS } from "@/lib/navigation";
import { listPendingRequests } from "@/server/appointments";
import { requireContext } from "@/server/context";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();
  const visible = (item: { permission?: Parameters<typeof ctx.can>[0] }) => !item.permission || ctx.can(item.permission);
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length > 0);
  const pending = ctx.can("appointments.view") ? (await listPendingRequests(ctx.business.id, new Date())).length : 0;

  return (
    <div className="min-h-dvh">
      <Sidebar groups={groups} footer={NAV_FOOTER.filter(visible)} business={ctx.business} user={ctx.user} pendingCount={pending} />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
