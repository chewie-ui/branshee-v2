import type { Metadata } from "next";
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
import { NAV_FOOTER, NAV_GROUPS, navGroupsFor } from "@/lib/navigation";
import { currentBrand } from "@/server/brand";
import { visibleApps } from "@/server/apps";
import { SkydevShell, type ShellApp } from "@/components/app/skydev-shell";
import { listPendingRequests } from "@/server/appointments";
import { requireContext } from "@/server/context";
import { clientWord } from "@/lib/terminology";
import { PlanBanner } from "@/components/app/plan-banner";
import { BrandNameProvider } from "@/components/brand-context";
import { effectivePlan } from "@/server/plan";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { assistantAllowed, assistantEnabled } from "@/server/assistant";

export const dynamic = "force-dynamic";

/** Le titre de l'onglet suit la marque de l'adresse visitée (« … · Skydev » ou « … · Branshee »). */
export async function generateMetadata(): Promise<Metadata> {
  const { name } = await currentBrand();
  return { title: { default: name, template: `%s · ${name}` } };
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();
  // Espace pro en maintenance : le super-admin passe quand même (pour vérifier avant de rouvrir).
  const gate = await featureStatus("admin_panel");
  if (gate.status !== "active" && !(await getSessionUser())?.user.isSuperadmin) return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const hidden = await hiddenNavHrefs();
  const visible = (item: { permission?: Parameters<typeof ctx.can>[0] }) => !item.permission || ctx.can(item.permission);
  const brand = await currentBrand();
  const [pending, adminMessages, unread, plan] = await Promise.all([
    ctx.can("appointments.manage") ? listPendingRequests(ctx.business.id).then((l) => l.length) : Promise.resolve(0),
    activeAdminMessages(ctx.user.id),
    supportUnread(ctx.user.id),
    effectivePlan(ctx.business.id),
  ]);
  const clients = clientWord(ctx.business.businessType, { plural: true, capitalize: true });
  const groups = navGroupsFor(brand.id).map((g) => ({
    ...g,
    items: g.items
      .filter(visible)
      .filter((i) => !hidden.has(i.href))
      // « Demandes » n'apparaît que lorsqu'il y en a ; « Clients » devient « Patients » pour les métiers de santé.
      .filter((i) => i.href !== "/app/demandes" || pending > 0)
      .map((i) => (i.href === "/app/clients" ? { ...i, label: clients } : i)),
  })).filter((g) => g.items.length > 0);

  const banners = (
    <>
      {!ctx.impersonating ? <SupervisionPrompt /> : null}
      <AdminMessages messages={adminMessages} />
      <PlanBanner brand={brand.id} plan={plan} canManage={ctx.can("billing.manage")} timezone={ctx.business.timezone} />
    </>
  );

  if (brand.id === "skydev") {
    // Une app = ses menus uniquement (filtrés par permissions) ; une app sans menu accessible n'apparaît pas.
    const [apps, ai]: [ShellApp[], boolean] = await Promise.all([visibleApps(ctx, { pending }), assistantAllowed(ctx).then((ok) => (ok ? assistantEnabled(ctx.business.id) : false))]);
    // App RDV : la barre latérale Branshee à l'identique, avec un retour vers toutes les apps en tête.
    const rdvSidebar = {
      groups: [
        { label: null, items: [{ href: "/app", label: "Toutes les apps", icon: "apps" as const }] },
        ...NAV_GROUPS.map((g) => ({
          ...g,
          items: g.items
            .filter(visible)
            .filter((i) => !hidden.has(i.href))
            .filter((i) => i.href !== "/app/demandes" || pending > 0)
            // Employés est commun à toutes les apps : il est dans Administration, plus dans RDV.
            .filter((i) => i.href !== "/app/apps" && i.href !== "/app/modules" && i.href !== "/app/equipe")
            .map((i) => (i.href === "/app" ? { ...i, href: "/app/rdv" } : i.href === "/app/clients" ? { ...i, label: clients } : i)),
        })).filter((g) => g.items.length > 0),
      ],
      footer: NAV_FOOTER.filter(visible),
    };
    return (
      <BrandNameProvider name={brand.name}>
        {ctx.impersonating ? <ImpersonationBar name={ctx.user.name} /> : null}
        <SkydevShell apps={apps} rdv={rdvSidebar} business={ctx.business} businesses={ctx.businesses} user={ctx.user} badges={{ "/app/demandes": pending, "/app/aide": unread }}>
          {banners}
          {children}
        </SkydevShell>
        {ai ? <AssistantPanel /> : null}
        <RegisterServiceWorker />
        <GuidedTour />
      </BrandNameProvider>
    );
  }

  return (
    <div className="min-h-dvh">
      {ctx.impersonating ? <ImpersonationBar name={ctx.user.name} /> : null}
      <Sidebar brand={brand.id} groups={groups} footer={NAV_FOOTER.filter(visible)} business={ctx.business} businesses={ctx.businesses} user={ctx.user} pendingCount={pending} supportUnread={unread} />
      <RegisterServiceWorker />
      <GuidedTour />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {banners}
          {children}
        </div>
      </main>
    </div>
  );
}
