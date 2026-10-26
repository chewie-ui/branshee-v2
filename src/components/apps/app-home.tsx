import Link from "next/link";
import type { VisibleApp } from "@/server/apps";
import { AppIcon } from "@/components/apps/app-icon";

/** Accueil Skydev : une grande icône par app, comme un écran de téléphone. */
export function AppHome({ apps, activeAddons }: { apps: VisibleApp[]; activeAddons: string[] }) {
  return (
    <ul className="mx-auto grid max-w-4xl grid-cols-3 gap-x-3 gap-y-8 sm:grid-cols-4 sm:gap-x-6 lg:grid-cols-5">
      {apps.map((app) => {
        const tag = app.status === "soon" ? { text: "Bientôt", cls: "bg-warning-soft text-warning" } : app.billing === "addon" ? (activeAddons.includes(app.id) ? { text: "Actif", cls: "bg-success-soft text-success" } : { text: "Option", cls: "bg-accent-soft text-accent-soft-foreground" }) : app.billing === "quote" ? { text: "Sur devis", cls: "bg-accent-soft text-accent-soft-foreground" } : null;
        return (
          <li key={app.id}>
            <Link href={app.href} className="group flex flex-col items-center gap-2.5 rounded-2xl p-2 text-center outline-offset-4">
              <span className="relative flex size-16 items-center justify-center rounded-2xl border border-border bg-surface text-accent shadow-sm transition-[transform,box-shadow,border-color] duration-150 group-hover:-translate-y-0.5 group-hover:border-border-strong group-hover:shadow-md sm:size-20">
                <AppIcon icon={app.icon} className="size-7 sm:size-8" />
              </span>
              <span className="text-sm font-medium text-text">{app.name}</span>
              {tag ? <span className={`-mt-1.5 rounded px-1.5 text-[11px] font-semibold ${tag.cls}`}>{tag.text}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
