import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminMessages, users } from "@/db/schema";
import { AdminMessageForm, DeleteMessageButton } from "@/components/admin/relations";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Messages aux pros" };
const TYPES: Record<string, string> = { info: "Information", tip: "Astuce", success: "Bonne nouvelle", warning: "Attention", security: "Sécurité" };

export default async function AdminMessagesPage() {
  await requireSuperadmin();
  const rows = await db
    .select({
      id: adminMessages.id,
      title: adminMessages.title,
      body: adminMessages.body,
      type: adminMessages.type,
      createdAt: adminMessages.createdAt,
      recipient: users.email,
      dismissed: sql<number>`(select count(*)::int from admin_message_dismissals d where d.message_id = ${adminMessages.id})`,
    })
    .from(adminMessages)
    .leftJoin(users, eq(users.id, adminMessages.recipientId))
    .orderBy(desc(adminMessages.createdAt))
    .limit(100);

  return (
    <>
      <PageHeader title="Messages aux pros" description="Affichés en bannière en haut de l'espace pro pendant 60 jours, jusqu'à ce que le pro les ferme." />
      <Card className="mb-6">
        <CardHeader title="Nouveau message" />
        <AdminMessageForm />
      </Card>
      <Card>
        <CardHeader title="Derniers messages" />
        <ul className="divide-y divide-border">
          {rows.map((m) => (
            <li key={m.id} className="flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.title}</span>
                  <Badge tone={m.type === "warning" || m.type === "security" ? "warning" : "accent"}>{TYPES[m.type]}</Badge>
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">{m.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {formatDay(m.createdAt, "Europe/Brussels", "d MMM yyyy")} · {m.recipient ?? "Tous les pros"} · fermé par {m.dismissed}
                </p>
              </div>
              <DeleteMessageButton id={m.id} />
            </li>
          ))}
          {rows.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Aucun message envoyé.</li> : null}
        </ul>
      </Card>
    </>
  );
}
