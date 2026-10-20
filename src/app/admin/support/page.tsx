import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { supportMessages, supportThreads, users } from "@/db/schema";
import { AutoRefresh, SupportReply } from "@/components/admin/relations";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatDay, formatTime } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";
import { MessagesSquare } from "lucide-react";

export const metadata: Metadata = { title: "Support" };
const TZ = "Europe/Brussels";

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  await requireSuperadmin();
  const sp = await searchParams;
  const threads = await db
    .select({
      userId: supportThreads.userId,
      unread: supportThreads.unreadByAdmin,
      last: supportThreads.lastMessageAt,
      closedAt: supportThreads.closedAt,
      rating: supportThreads.rating,
      name: users.fullName,
      email: users.email,
      business: sql<string | null>`(select name from businesses where owner_id = ${users.id} and deleted_at is null order by created_at limit 1)`,
      preview: sql<string | null>`(select body from support_messages where thread_user_id = ${supportThreads.userId} order by created_at desc limit 1)`,
    })
    .from(supportThreads)
    .innerJoin(users, eq(users.id, supportThreads.userId))
    .orderBy(desc(supportThreads.unreadByAdmin), desc(supportThreads.lastMessageAt))
    .limit(200);
  const [stats] = await db.execute<{ avg: number | null; n: number }>(sql`select round(avg(rating)::numeric, 1)::float as avg, count(*)::int as n from support_ratings`);
  const selected = threads.find((t) => t.userId === sp.u) ?? null;
  const messages = selected ? await db.select().from(supportMessages).where(eq(supportMessages.threadUserId, selected.userId)).orderBy(asc(supportMessages.createdAt)).limit(500) : [];
  if (selected?.unread) await db.update(supportThreads).set({ unreadByAdmin: 0 }).where(eq(supportThreads.userId, selected.userId));

  return (
    <>
      <AutoRefresh />
      <PageHeader title="Support" description={stats?.n ? `Satisfaction : ${stats.avg?.toString().replace(".", ",")} / 5 sur ${stats.n} note${stats.n > 1 ? "s" : ""}` : "Conversations avec les pros"} />
      {threads.length === 0 ? (
        <Card><EmptyState icon={<MessagesSquare />} title="Aucune conversation" description="Les messages envoyés depuis « Aide et support » arrivent ici." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className={cn("overflow-hidden", selected && "hidden lg:block")}>
            <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
              {threads.map((t) => (
                <li key={t.userId}>
                  <Link href={`/admin/support?u=${t.userId}`} className={cn("block px-4 py-3 hover:bg-surface-muted", t.userId === selected?.userId && "bg-accent-soft/60")}>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{t.business ?? t.name}</span>
                      {t.unread ? <span className="rounded-full bg-accent px-1.5 text-xs leading-5 font-semibold text-accent-foreground">{t.unread}</span> : <span className="shrink-0 text-xs text-muted">{formatDay(t.last, TZ, "d MMM")}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{t.preview ?? "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {selected ? (
            <Card className="flex min-h-[60vh] flex-col">
              <header className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
                <Link href="/admin/support" className="text-sm text-accent lg:hidden">← Conversations</Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{selected.name}{selected.business ? ` · ${selected.business}` : ""}</p>
                  <p className="truncate text-sm text-muted">{selected.email}</p>
                </div>
                {selected.closedAt ? <Badge>{selected.rating ? `Clôturée · ${selected.rating}/5` : "Clôturée"}</Badge> : <Badge tone="accent">Ouverte</Badge>}
                <Link href={`/admin/utilisateurs/${selected.userId}`} className="text-sm font-medium text-accent hover:text-accent-hover">Fiche</Link>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.sender === "admin" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", m.sender === "admin" ? "rounded-br-sm bg-accent text-accent-foreground" : "rounded-bl-sm bg-surface-muted")}>
                      <p className="whitespace-pre-line break-words">{m.body}</p>
                      <p className={cn("mt-1 text-[11px]", m.sender === "admin" ? "text-accent-foreground/70" : "text-muted")}>{formatDay(m.createdAt, TZ, "d MMM")} · {formatTime(m.createdAt, TZ)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <SupportReply key={selected.userId} userId={selected.userId} closed={!!selected.closedAt} />
            </Card>
          ) : (
            <Card className="hidden items-center justify-center p-10 text-sm text-muted lg:flex">Choisissez une conversation.</Card>
          )}
        </div>
      )}
    </>
  );
}
