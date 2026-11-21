import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { desc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, users } from "@/db/schema";
import { DeleteSuspectsButton, DisableUserButton } from "@/components/admin/admin-actions";
import { suspectAccounts } from "@/server/suspect-accounts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Utilisateurs" };

const TZ = "Europe/Brussels";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireSuperadmin();
  const q = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select({
      id: users.id,
      name: users.fullName,
      email: users.email,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      disabledAt: users.disabledAt,
      isSuperadmin: users.isSuperadmin,
      owned: sql<number>`(select count(*)::int from ${businesses} where ${businesses.ownerId} = "users"."id" and ${businesses.deletedAt} is null)`,
    })
    .from(users)
    .where(q ? or(ilike(users.email, like), ilike(users.fullName, like)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100);
  const suspects = await suspectAccounts();
  const suspectIds = new Set(suspects.map((x) => x.id));

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description={q ? `${rows.length} résultat${rows.length > 1 ? "s" : ""} pour « ${q} »` : "Les 100 comptes les plus récents"}
        action={
          // Téléchargement (route serveur) : lien classique.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="/admin/utilisateurs/export" className="inline-flex h-10 items-center rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted">Exporter (CSV)</a>}
      />
      {suspects.length ? (
        <Card className="mb-4 border-warning/40 p-4">
          <p className="text-sm">
            <b>{suspects.length} faux compte{suspects.length > 1 ? "s" : ""} probable{suspects.length > 1 ? "s" : ""}</b> (robots) : email jamais confirmé depuis plus d&apos;un jour, nom d&apos;un seul mot, aucun établissement, aucune équipe, aucune fiche client.
            Les inscriptions sont maintenant protégées contre ces robots ; ces comptes-là peuvent être supprimés sans rien perdre.
          </p>
          <p className="mt-1 text-xs text-muted">{suspects.slice(0, 12).map((x) => x.name).join(", ")}{suspects.length > 12 ? "…" : ""}</p>
          <div className="mt-3"><DeleteSuspectsButton ids={suspects.map((x) => x.id)} /></div>
        </Card>
      ) : null}
      <form className="relative mb-4 max-w-md" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input name="q" defaultValue={q} placeholder="Nom ou email" className="pl-9" aria-label="Rechercher un utilisateur" />
      </form>
      <Card>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">Aucun utilisateur trouvé.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/utilisateurs/${u.id}`} className="truncate font-medium hover:underline">{u.name}</Link>
                    {u.isSuperadmin ? <Badge tone="accent">Super-admin</Badge> : null}
                    {u.disabledAt ? <Badge tone="danger">Désactivé</Badge> : null}
                    {suspectIds.has(u.id) ? <Badge tone="warning">Faux compte probable</Badge> : null}
                  </p>
                  <p className="truncate text-sm text-muted">{u.email}</p>
                </div>
                <p className="w-40 text-sm text-muted">
                  {u.owned > 0 ? `${u.owned} établissement${u.owned > 1 ? "s" : ""}` : "Client / membre"}
                </p>
                <p className="w-44 text-sm text-muted">
                  Inscrit le {formatDay(u.createdAt, TZ, "d MMM yyyy")}
                  <br />
                  {u.lastLoginAt ? `Vu le ${formatDay(u.lastLoginAt, TZ, "d MMM yyyy")}` : "Jamais connecté"}
                </p>
                {u.id !== admin.id ? <DisableUserButton id={u.id} disabled={!!u.disabledAt} /> : <span className="w-24" />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
