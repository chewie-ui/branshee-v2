import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Réglages" description="Tout ce qu'on règle une fois, rangé par thème." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <SettingsNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
