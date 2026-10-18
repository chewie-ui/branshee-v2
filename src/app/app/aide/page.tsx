import type { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";
import { HelpCenter } from "@/components/help/help-center";
import { SupportChat } from "@/components/help/support-chat";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { richTextToPlain, sanitizeArticleHtml } from "@/server/rich-text";
import { DEFAULT_HELP, getSupportThread, listHelpSections } from "@/server/support";

export const metadata: Metadata = { title: "Aide et support" };

export default async function HelpPage() {
  const ctx = await requireContext();
  const [rows, thread] = await Promise.all([listHelpSections(), getSupportThread(ctx.user.id)]);
  const source = rows.length ? rows : DEFAULT_HELP.map((s, i) => ({ ...s, id: `default-${i}` }));
  // Les réponses sont rédigées dans l'éditeur du super-admin : HTML nettoyé avant affichage.
  const sections = source.map((s) => ({
    id: s.id,
    title: s.title,
    videos: s.videos,
    faqs: s.faqs.map((f) => ({ id: f.id, question: f.question, answerHtml: sanitizeArticleHtml(f.answer), answerText: richTextToPlain(f.answer) })),
  }));
  const supportEmail = process.env.SUPPORT_EMAIL || "support@branshee.com";
  const whatsapp = (process.env.SUPPORT_WHATSAPP || "32477443988").replace(/\D/g, "");

  return (
    <>
      <PageHeader title="Aide et support" description="Visites guidées, vidéos, questions fréquentes, et une équipe humaine pour vous répondre." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <HelpCenter sections={sections} />
        <div id="contact" className="scroll-mt-6 space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader title="Écrire à l'équipe" description="Réponse humaine, souvent dans la journée." />
            <SupportChat initial={thread} firstName={ctx.user.name.split(" ")[0] ?? ""} />
          </Card>
          <Card className="divide-y divide-border">
            <a href={`mailto:${supportEmail}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-muted">
              <Mail className="size-4 text-muted" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-medium">Email</span>
                <span className="block truncate text-muted">{supportEmail}</span>
              </span>
            </a>
            {whatsapp ? (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-muted">
                <MessageCircle className="size-4 text-muted" aria-hidden="true" />
                <span>
                  <span className="block font-medium">WhatsApp</span>
                  <span className="block text-muted">Pour une question rapide</span>
                </span>
              </a>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
