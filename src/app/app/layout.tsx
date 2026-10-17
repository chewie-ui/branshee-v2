import type { ReactNode } from "react";
import { Sidebar } from "@/components/app/sidebar";
import { NAV_FOOTER, NAV_GROUPS } from "@/lib/navigation";
import { listPendingRequests } from "@/server/appointments";
import { requireContext } from "@/server/context";
import { clientWord } from "@/lib/terminology";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();
  const visible = (item: { permission?: Parameters<typeof ctx.can>[0] }) => !item.permission || ctx.can(item.permission);
  const pending = ctx.can("appointments.manage") ? (await listPendingRequests(ctx.business.id)).length : 0;
  const clients = clientWord(ctx.business.businessType, { plural: true, capitalize: true });
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items
      .filter(visible)
      // « Demandes » n'apparaît que lorsqu'il y en a ; « Clients » devient « Patients » pour les métiers de santé.
      .filter((i) => i.href !== "/app/demandes" || pending > 0)
      .map((i) => (i.href === "/app/clients" ? { ...i, label: clients } : i)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-dvh">
      <Sidebar groups={groups} footer={NAV_FOOTER.filter(visible)} business={ctx.business} businesses={ctx.businesses} user={ctx.user} pendingCount={pending} />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
