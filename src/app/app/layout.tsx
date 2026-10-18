import type { ReactNode } from "react";
import { Sidebar } from "@/components/app/sidebar";
import { RegisterServiceWorker } from "@/components/app/register-sw";
import { AdminMessages } from "@/components/app/admin-messages";
import { GuidedTour } from "@/components/app/guided-tour";
import { ImpersonationBar, SupervisionPrompt } from "@/components/app/supervision";
import { activeAdminMessages, supportUnread } from "@/server/support";
import { FeatureStatusPage } from "@/components/feature-status";
import { getSessionUser } from "@/server/auth/session";
import { featureStatus, hiddenNavHrefs } from "@/server/features";
import { NAV_FOOTER, NAV_GROUPS } from "@/lib/navigation";
import { listPendingRequests } from "@/server/appointments";
import { requireContext } from "@/server/context";
import { clientWord } from "@/lib/terminology";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();
  // Espace pro en maintenance : le super-admin passe quand même (pour vérifier avant de rouvrir).
  const gate = await featureStatus("admin_panel");
  if (gate.status !== "active" && !(await getSessionUser())?.user.isSuperadmin) return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const hidden = await hiddenNavHrefs();
  const visible = (item: { permission?: Parameters<typeof ctx.can>[0] }) => !item.permission || ctx.can(item.permission);
  const [pending, adminMessages, unread] = await Promise.all([
    ctx.can("appointments.manage") ? listPendingRequests(ctx.business.id).then((l) => l.length) : Promise.resolve(0),
    activeAdminMessages(ctx.user.id),
    supportUnread(ctx.user.id),
  ]);
  const clients = clientWord(ctx.business.businessType, { plural: true, capitalize: true });
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items
      .filter(visible)
      .filter((i) => !hidden.has(i.href))
      // « Demandes » n'apparaît que lorsqu'il y en a ; « Clients » devient « Patients » pour les métiers de santé.
      .filter((i) => i.href !== "/app/demandes" || pending > 0)
      .map((i) => (i.href === "/app/clients" ? { ...i, label: clients } : i)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-dvh">
      {ctx.impersonating ? <ImpersonationBar name={ctx.user.name} /> : null}
      <Sidebar groups={groups} footer={NAV_FOOTER.filter(visible)} business={ctx.business} businesses={ctx.businesses} user={ctx.user} pendingCount={pending} supportUnread={unread} />
      <RegisterServiceWorker />
      <GuidedTour />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {!ctx.impersonating ? <SupervisionPrompt /> : null}
          <AdminMessages messages={adminMessages} />
          {children}
        </div>
      </main>
    </div>
  );
}
