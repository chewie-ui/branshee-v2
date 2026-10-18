import type { Metadata } from "next";
import Link from "next/link";
import { HelpSectionEditor, NewHelpSection } from "@/components/admin/relations";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSuperadmin } from "@/server/admin";
import { listHelpSections } from "@/server/support";

export const metadata: Metadata = { title: "Centre d'aide" };

export default async function AdminHelp() {
  await requireSuperadmin();
  const sections = await listHelpSections();
  return (
    <>
      <PageHeader
        title="Centre d'aide"
        description="Sections de vidéos et de questions fréquentes affichées dans « Aide et support ». Tant qu'aucune section n'existe, un contenu par défaut est affiché."
        action={<Link href="/app/aide" target="_blank" className="text-sm font-medium text-accent hover:text-accent-hover">Voir comme un pro</Link>}
      />
      <div className="space-y-4">
        {sections.map((s, i) => (
          <Card key={s.id}>
            <HelpSectionEditor
              key={s.updatedAt.toISOString()}
              initial={{ id: s.id, title: s.title, videos: s.videos.map((v) => ({ id: v.id, title: v.title, url: v.url, duration: v.duration ?? "" })), faqs: s.faqs }}
              first={i === 0}
              last={i === sections.length - 1}
            />
          </Card>
        ))}
        <Card className="p-5">
          <NewHelpSection />
        </Card>
      </div>
    </>
  );
}
