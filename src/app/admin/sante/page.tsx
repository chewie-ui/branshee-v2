import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Database, HardDrive, Mail, Server, XCircle } from "lucide-react";
import { ResolveErrorButton } from "@/components/admin/health-actions";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { JOBS, jobLate } from "@/lib/health";
import { healthSnapshot } from "@/server/health";

export const metadata: Metadata = { title: "Santé et problèmes" };
export const dynamic = "force-dynamic";

const ago = (d: Date | null) => {
  if (!d) return "jamais";
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
};
const SRC: Record<string, string> = { server: "Site", stripe: "Stripe", cron: "Tâche auto" };

/** Tout ce qui ne va pas sur la plateforme, en un coup d'œil : erreurs, emails, paiements, tâches, serveur. */
export default async function HealthPage() {
  const h = await healthSnapshot();
  const lateJobs = Object.keys(JOBS).filter((n) => jobLate(n, h.jobs.find((j) => j.name === n)?.lastRunAt ?? null));
  const failedJobs = h.jobs.filter((j) => !j.ok);
  const mailFailed = h.mailStats.failed ?? 0;
  const mailTotal = Object.values(h.mailStats).reduce((a, b) => a + b, 0);
  const missingConfig = Object.entries({ "Paiements Stripe": h.config.stripe, "Envoi d'emails (SMTP)": h.config.smtp, "Clé de chiffrement": h.config.encryption }).filter(([, ok]) => !ok).map(([k]) => k);
  const problems = h.errors.length + lateJobs.length + failedJobs.length + (mailFailed ? 1 : 0) + h.pastDue.length + missingConfig.length;
  const tiles = [
    { icon: AlertTriangle, label: "Erreurs ouvertes", value: h.errors.length, bad: h.errors.length > 0 },
    { icon: Mail, label: "Emails non partis (7 j)", value: `${mailFailed} / ${mailTotal}`, bad: mailFailed > 0 },
    { icon: CreditCard, label: "Abonnements impayés", value: h.pastDue.length, bad: h.pastDue.length > 0 },
    { icon: Clock, label: "Tâches en panne", value: lateJobs.length + failedJobs.length, bad: lateJobs.length + failedJobs.length > 0 },
  ];

  return (
    <>
      <PageHeader title="Santé et problèmes" description="Erreurs, emails, paiements, tâches automatiques et serveur. Vous recevez un email à chaque nouvelle erreur." />
      <div className={`mb-6 flex items-center gap-3 rounded-xl border p-4 ${problems ? "border-danger/30 bg-danger-soft text-danger" : "border-success/30 bg-success-soft text-success"}`} role="status">
        {problems ? <XCircle className="size-6 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="size-6 shrink-0" aria-hidden="true" />}
        <p className="font-semibold">{problems ? `${problems} point${problems > 1 ? "s" : ""} à regarder` : "Tout fonctionne normalement"}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="flex items-center gap-2 text-sm text-muted"><t.icon className="size-4" aria-hidden="true" />{t.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${t.bad ? "text-danger" : ""}`}>{t.value}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Erreurs" description="Regroupées : une même erreur n'apparaît qu'une fois, avec le nombre de fois." action={h.errors.length > 1 ? <ResolveErrorButton id="all" label="Tout marquer réglé" /> : undefined} />
          {h.errors.length ? (
            <ul className="divide-y divide-border">
              {h.errors.map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium"><span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-muted">{SRC[e.source] ?? e.source}</span><span className="break-words">{e.message}</span></p>
                      <p className="mt-0.5 text-xs text-muted">{e.path ?? "—"} · {e.count} fois · dernière {ago(e.lastSeenAt)} · première {ago(e.firstSeenAt)}</p>
                    </div>
                    <ResolveErrorButton id={e.id} label="Réglé" />
                  </div>
                  {e.detail ? <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-accent">Détails techniques</summary><pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-surface-muted p-3 text-xs whitespace-pre-wrap">{e.detail}</pre></details> : null}
                </li>
              ))}
            </ul>
          ) : <p className="px-5 py-4 text-sm text-muted">Aucune erreur ouverte.</p>}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Tâches automatiques" description="Rappels de RDV, relances, fidélité, parrainages…" />
            <ul className="divide-y divide-border">
              {Object.entries(JOBS).map(([name, j]) => {
                const run = h.jobs.find((r) => r.name === name);
                const late = jobLate(name, run?.lastRunAt ?? null);
                const bad = late || (run && !run.ok);
                return (
                  <li key={name} className="flex items-start gap-3 px-5 py-3 text-sm">
                    {bad ? <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{j.label}</span>
                      <span className="block text-xs text-muted">Dernier passage {ago(run?.lastRunAt ?? null)}{run ? ` · ${run.durationMs} ms` : ""}{late ? " · en retard" : ""}{run && !run.ok ? ` · échec : ${run.result}` : ""}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Serveur" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-sm">
              <div><dt className="flex items-center gap-1.5 text-muted"><Server className="size-4" aria-hidden="true" />En ligne depuis</dt><dd className="font-medium">{h.system.uptimeH} h</dd></div>
              <div><dt className="text-muted">Mémoire utilisée</dt><dd className="font-medium">{h.system.memMb} Mo</dd></div>
              <div><dt className="flex items-center gap-1.5 text-muted"><Database className="size-4" aria-hidden="true" />Base de données</dt><dd className="font-medium">{h.system.dbSize}</dd></div>
              <div><dt className="flex items-center gap-1.5 text-muted"><HardDrive className="size-4" aria-hidden="true" />Disque libre</dt><dd className={`font-medium ${h.system.disk && h.system.disk.freeGb < 5 ? "text-danger" : ""}`}>{h.system.disk ? `${h.system.disk.freeGb} Go / ${h.system.disk.totalGb} Go` : "—"}</dd></div>
            </dl>
            <ul className="space-y-1 border-t border-border px-5 py-4 text-sm">
              {Object.entries({ "Paiements Stripe": h.config.stripe, "Envoi d'emails": h.config.smtp, "Chiffrement des dossiers": h.config.encryption, "Connexion Google": h.config.google, "Assistant IA": h.config.ai }).map(([k, ok]) => (
                <li key={k} className="flex items-center gap-2">{ok ? <CheckCircle2 className="size-4 text-success" aria-hidden="true" /> : <XCircle className="size-4 text-muted" aria-hidden="true" />}{k}<span className="text-xs text-muted">{ok ? "configuré" : "non configuré"}</span></li>
              ))}
            </ul>
          </Card>
        </div>

        <Card>
          <CardHeader title="Abonnements impayés" description="Paiement Stripe refusé : Stripe réessaie, mais un message au client aide souvent." />
          {h.pastDue.length ? (
            <ul className="divide-y divide-border">
              {h.pastDue.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><Link href={`/admin/etablissements/${p.id}`} className="font-medium text-accent hover:text-accent-hover">{p.name}</Link><span className="text-muted">Paiement en retard</span></li>)}
            </ul>
          ) : <p className="px-5 py-4 text-sm text-muted">Aucun impayé.</p>}
        </Card>

        <Card>
          <CardHeader title="Emails non partis (7 derniers jours)" />
          {h.mails.length ? (
            <ul className="divide-y divide-border">
              {h.mails.map((m, i) => <li key={i} className="px-5 py-3 text-sm"><p className="font-medium">{m.subject}</p><p className="text-xs text-muted">{m.template} · vers @{m.to.split("@")[1] ?? "?"} · {ago(m.at)}{m.error ? ` · ${m.error.slice(0, 160)}` : ""}</p></li>)}
            </ul>
          ) : <p className="px-5 py-4 text-sm text-muted">Tous les emails sont partis.</p>}
        </Card>
      </div>
    </>
  );
}
