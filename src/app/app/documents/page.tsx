import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { DocExplorer } from "@/components/documents/doc-explorer";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { QUOTA_BYTES, allFolders, docRights, folderContent, folderPath, searchDocuments, usedBytes } from "@/server/documents";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ dossier?: string; q?: string }> }) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const folderId = sp.dossier && /^[0-9a-f-]{36}$/i.test(sp.dossier) ? sp.dossier : null;
  const path = await folderPath(ctx.business.id, folderId);
  if (!path) notFound();
  const q = (sp.q ?? "").trim().slice(0, 100);
  const [content, found, used, folders, clients] = await Promise.all([
    q ? Promise.resolve({ folders: [], files: [] }) : folderContent(ctx.business.id, folderId),
    q ? searchDocuments(ctx.business.id, q) : Promise.resolve(null),
    usedBytes(ctx.business.id),
    allFolders(ctx.business.id),
    ctx.can("customers.view") ? db.select({ id: customers.id, name: customers.fullName }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(3000) : Promise.resolve([]),
  ]);
  const ser = <T extends { createdAt: Date; shareExpiresAt: Date | null }>(f: T) => ({ ...f, createdAt: f.createdAt.toISOString(), shareExpiresAt: f.shareExpiresAt?.toISOString() ?? null });
  return (
    <>
      <PageHeader title="Documents" description="Les fichiers de l'équipe, rangés par dossier et chiffrés sur nos serveurs." />
      <DocExplorer
        folderId={folderId}
        path={path}
        q={q}
        subfolders={content.folders}
        files={(found ?? content.files).map(ser)}
        allFolders={folders}
        clients={clients}
        me={ctx.member.id}
        canManage={docRights(ctx).manage}
        usedBytes={used}
        quotaBytes={QUOTA_BYTES}
      />
    </>
  );
}
