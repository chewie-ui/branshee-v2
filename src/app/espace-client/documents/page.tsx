import type { Metadata } from "next";
import { Download, FileText, NotebookPen, Paperclip } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { decrypt } from "@/lib/field-crypto";
import { formatDay } from "@/lib/time";
import { listMyShares, markSharesSeen, requireClient } from "@/server/client-account";

export const metadata: Metadata = { title: "Mes documents" };

const kb = (n: number | null) => (n ? (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`) : "");
const safe = (v: string | null) => {
  try {
    return decrypt(v) ?? "";
  } catch {
    return "";
  }
};

export default async function MyDocuments() {
  const user = await requireClient("/espace-client/documents");
  const rows = await listMyShares(user.id);
  // Les notes sont lues en ouvrant la page ; les fichiers, en les téléchargeant.
  await markSharesSeen(rows.filter((r) => r.s.kind === "note" && !r.s.seenAt).map((r) => r.s.id));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mes documents</h1>
        <p className="mt-1 text-sm text-muted">Les notes et fichiers que vos pros partagent avec vous : exercices, consignes, choses à ramener…</p>
      </div>
      {rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          <FileText className="mx-auto mb-2 size-8" aria-hidden="true" />
          Rien pour l&apos;instant. Quand un pro partage une note ou un fichier avec vous, il apparaît ici.
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {rows.map(({ s, business }) => (
              <li key={s.id} className="flex items-start gap-3 px-4 py-4">
                <Avatar name={business.name} src={business.photoUrl} size="sm" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="flex items-center gap-1.5 font-medium">
                    {s.kind === "note" ? <NotebookPen className="size-4 shrink-0 text-muted" aria-hidden="true" /> : <Paperclip className="size-4 shrink-0 text-muted" aria-hidden="true" />}
                    <span className="truncate">{s.title || (s.kind === "note" ? "Note" : s.fileName)}</span>
                  </p>
                  {s.kind === "note" ? <p className="mt-1 whitespace-pre-line">{safe(s.bodyEnc)}</p> : <p className="mt-0.5 text-muted">{s.fileName} · {kb(s.sizeBytes)}</p>}
                  <p className="mt-1 text-xs text-muted">{business.name} · {formatDay(s.createdAt, business.timezone, "d MMMM yyyy")}</p>
                </div>
                {s.kind === "file" ? (
                  <a href={`/espace-client/documents/${s.id}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={`Télécharger ${s.fileName ?? "le fichier"}`}>
                    <Download className="size-4" aria-hidden="true" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
