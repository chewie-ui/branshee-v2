"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Code2, Copy, ExternalLink, KeyRound, Link2, Mail, Plus, Send, ShieldCheck, ShoppingBag, CalendarDays, Trash2, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { EVENTS, SCOPES, type Scope, type WebhookEvent } from "@/lib/connect-meta";
import { createApiKey, createWebhook, deleteWebhook, revokeApiKey, testWebhook } from "@/server/actions/connect";

type Res = { ok: boolean; message?: string; error?: string; secret?: string };
type Key = { id: string; name: string; prefix: string; scopes: string[]; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };
type Hook = { id: string; url: string; events: string[]; lastStatus: number | null; lastError: string | null; lastAt: string | null };
type Delivery = { id: string; webhookId: string; event: string; status: string; attempts: number; lastError: string | null; createdAt: string };

const resize = `<script>
(function(){
  window.addEventListener('message',function(e){
    if(!e.data||e.data.type!=='branshee-resize')return;
    var fr=document.getElementsByTagName('iframe');
    for(var i=0;i<fr.length;i++){if(fr[i].contentWindow===e.source){fr[i].style.height=Math.min(e.data.height+24,4000)+'px';break;}}
  });
})();
</script>`;

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg bg-zinc-950">
      <div className="flex items-center justify-end border-b border-white/10 px-2 py-1.5">
        <button type="button" onClick={() => { navigator.clipboard?.writeText(code).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {}); }} className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/20" aria-label={`Copier : ${label}`}>
          {done ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}{done ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="max-h-48 overflow-auto p-3 text-xs leading-relaxed text-zinc-100"><code>{code}</code></pre>
    </div>
  );
}

/** Une seule fois : la clé ou le secret qui vient d'être créé, à copier tout de suite. */
function SecretOnce({ value, onClose }: { value: string; onClose: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-warning/40 bg-warning-soft p-4" role="status">
      <p className="text-sm font-medium text-warning">À copier maintenant : il ne sera plus jamais affiché.</p>
      <CopyBlock code={value} label="secret" />
      <p className="text-xs text-muted">Gardez-le sur le serveur de votre site (variable d&apos;environnement), jamais dans le code de vos pages ni dans un e-mail.</p>
      <Button size="sm" variant="secondary" onClick={onClose}>C&apos;est copié</Button>
    </div>
  );
}

export function ConnectPanel({ origin, slug, shopEnabled, keys, hooks, deliveries, timezone }: { origin: string; slug: string; shopEnabled: boolean; keys: Key[]; hooks: Hook[]; deliveries: Delivery[]; timezone: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [secret, setSecret] = useState<{ kind: "key" | "hook"; value: string } | null>(null);
  const [keyName, setKeyName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["rdv", "contacts", "business"]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["appointment.created", "appointment.cancelled", "contact.created"]);
  const [revoke, setRevoke] = useState<Key | null>(null);
  const [del, setDel] = useState<Hook | null>(null);
  const [pending, start] = useTransition();
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const run = (fn: () => Promise<Res>, after?: (r: Res) => void) =>
    start(async () => {
      const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") });
      if (r.ok) after?.(r);
      router.refresh();
    });
  const formUrl = `${origin}/formulaire/${slug}`;
  const shopUrl = `${origin}/boutique/${slug}`;
  const active = keys.filter((k) => !k.revokedAt);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <p className="text-muted">
          Reliez votre site à Skydev : les réservations, les messages et les commandes arrivent directement dans vos apps (Clients, RDV, Boutique).
          <span className="text-text"> Aucun mot de passe n&apos;est partagé</span> : les widgets n&apos;exposent que ce qui est déjà public, et les clés API sont secrètes, révocables à tout moment et limitées aux droits que vous choisissez.
        </p>
      </div>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      <section aria-labelledby="any-site" className="space-y-3">
        <div>
          <h2 id="any-site" className="text-lg font-semibold">1. Sur n&apos;importe quel site</h2>
          <p className="text-sm text-muted">WordPress, Wix, Webador, Squarespace, Shopify, un site fait par un développeur… Copiez le code et collez-le dans un bloc « HTML » ou « Code » de votre site.</p>
        </div>
        <Card>
          <CardHeader title="Prise de rendez-vous" description="Calendrier dans la page, bouton qui ouvre la réservation, ou bulle flottante sur tout le site." />
          <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
            <Link href="/app/page-de-reservation/partager" className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover"><CalendarDays className="size-4" aria-hidden="true" />Choisir le format et copier le code</Link>
            <span className="text-sm text-muted">Les rendez-vous arrivent dans l&apos;app RDV, la fiche client est créée.</span>
          </div>
        </Card>
        <Card>
          <CardHeader title="Formulaire de contact" description="Les messages arrivent dans Clients › Messages (et par e-mail), avec la fiche client créée." />
          <div className="space-y-3 px-5 pb-5">
            <CopyBlock label="formulaire de contact" code={`<iframe src="${formUrl}" style="width:100%;height:560px;border:0;" title="Formulaire de contact" loading="lazy"></iframe>\n${resize}`} />
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <a href={formUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover">Voir le formulaire<ExternalLink className="size-3.5" aria-hidden="true" /></a>
              <span>Couleur : ajoutez <code>?couleur=%23e11d48</code> à l&apos;adresse. Protégé contre les robots et le spam.</span>
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Boutique en ligne" description={shopEnabled ? "Vos produits en vente, avec panier et paiement : le stock et les commandes restent dans Skydev." : "Ouvrez d'abord votre boutique dans l'app Boutique."} />
          <div className="space-y-3 px-5 pb-5">
            {shopEnabled ? (
              <>
                <CopyBlock label="bouton boutique" code={`<a href="${shopUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#4f46e5;color:#fff;font-weight:600;text-decoration:none;">Voir la boutique</a>`} />
                <CopyBlock label="boutique dans la page" code={`<iframe src="${shopUrl}" style="width:100%;height:900px;border:0;" title="Boutique en ligne" loading="lazy" allow="payment"></iframe>`} />
              </>
            ) : <Link href="/app/boutique/reglages" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted"><ShoppingBag className="size-4" aria-hidden="true" />Ouvrir la boutique</Link>}
          </div>
        </Card>
        <p className="flex items-center gap-2 text-sm text-muted"><Link2 className="size-4" aria-hidden="true" />Pas de site du tout ? Créez-en un dans l&apos;app <Link href="/app/site" className="font-medium text-accent hover:text-accent-hover">Site web</Link> : tout y est déjà relié.</p>
      </section>

      <section aria-labelledby="custom-site" className="space-y-3">
        <div>
          <h2 id="custom-site" className="text-lg font-semibold">2. Site sur mesure (pour votre développeur)</h2>
          <p className="text-sm text-muted">Votre site affiche vos prestations, créneaux, produits et avis Skydev avec son propre design, et envoie réservations et messages. <Link href="/developpeurs" target="_blank" className="font-medium text-accent hover:text-accent-hover">Documentation de l&apos;API</Link></p>
        </div>

        <Card>
          <CardHeader title="Clés API" description="Une clé par site. Elle s'utilise uniquement côté serveur : Skydev refuse une clé envoyée depuis un navigateur." />
          <div className="space-y-4 px-5 pb-5">
            {secret?.kind === "key" ? <SecretOnce value={secret.value} onClose={() => setSecret(null)} /> : null}
            {active.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {active.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                    <KeyRound className="size-4 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{k.name} <code className="ml-1 text-xs text-muted">{k.prefix}…</code></span>
                      <span className="block text-xs text-muted">{k.scopes.map((s) => SCOPES[s as Scope]?.label ?? s).join(" · ")} · {k.lastUsedAt ? `utilisée le ${fmt.format(new Date(k.lastUsedAt))}` : "jamais utilisée"}</span>
                    </span>
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRevoke(k)}>Révoquer</Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aucune clé pour l&apos;instant.</p>}
            <div className="space-y-3 rounded-lg border border-dashed border-border-strong p-4">
              <Field label="Nom de la clé" htmlFor="key-name"><Input id="key-name" value={keyName} onChange={(e) => setKeyName(e.target.value)} maxLength={60} placeholder="Ex. : Site vitrine" /></Field>
              <fieldset>
                <legend className="text-sm font-medium">Ce que le site peut faire</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(Object.keys(SCOPES) as Scope[]).map((s) => (
                    <label key={s} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", scopes.includes(s) ? "border-accent bg-accent-soft" : "border-border")}>
                      <input type="checkbox" checked={scopes.includes(s)} onChange={() => setScopes((l) => toggle(l, s))} className="mt-0.5 size-4" />
                      <span><span className="block font-medium">{SCOPES[s].label}</span><span className="block text-xs text-muted">{SCOPES[s].desc}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button loading={pending} icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => run(() => createApiKey(keyName, scopes), (r) => { if (r.secret) setSecret({ kind: "key", value: r.secret }); setKeyName(""); })}>Créer la clé</Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Webhooks" description="Skydev prévient votre site en direct (nouveau rendez-vous, annulation, commande, message). Chaque envoi est signé : votre site vérifie qu'il vient bien de Skydev." />
          <div className="space-y-4 px-5 pb-5">
            {secret?.kind === "hook" ? <SecretOnce value={secret.value} onClose={() => setSecret(null)} /> : null}
            {hooks.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {hooks.map((h) => {
                  const last = deliveries.filter((d) => d.webhookId === h.id).slice(0, 5);
                  return (
                    <li key={h.id} className="space-y-2 px-3 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Webhook className="size-4 text-muted" aria-hidden="true" />
                        <code className="min-w-0 flex-1 truncate text-xs">{h.url}</code>
                        {h.lastAt ? (h.lastError ? <Badge tone="danger">Échec</Badge> : <Badge tone="success">OK</Badge>) : <Badge>Pas encore utilisé</Badge>}
                        <Button size="sm" variant="secondary" loading={pending} icon={<Send className="size-4" aria-hidden="true" />} onClick={() => run(() => testWebhook(h.id))}>Tester</Button>
                        <button type="button" onClick={() => setDel(h)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" aria-label="Supprimer ce webhook"><Trash2 className="size-4" aria-hidden="true" /></button>
                      </div>
                      <p className="text-xs text-muted">{h.events.map((e) => EVENTS[e as WebhookEvent] ?? e).join(" · ")}{h.lastAt ? ` · dernier envoi ${fmt.format(new Date(h.lastAt))}${h.lastError ? ` : ${h.lastError}` : ""}` : ""}</p>
                      {last.length ? (
                        <ul className="space-y-0.5 text-xs text-muted">
                          {last.map((d) => <li key={d.id}>{fmt.format(new Date(d.createdAt))} · {d.event} · {d.status === "sent" ? "reçu" : d.status === "failed" ? `échec${d.lastError ? ` (${d.lastError})` : ""}` : `nouvel essai prévu (${d.attempts} essai${d.attempts > 1 ? "s" : ""})`}</li>)}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="space-y-3 rounded-lg border border-dashed border-border-strong p-4">
              <Field label="Adresse de votre site qui reçoit les événements" htmlFor="hook-url" hint="https uniquement, sur votre nom de domaine."><Input id="hook-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://monsite.be/api/skydev" /></Field>
              <fieldset>
                <legend className="text-sm font-medium">Événements</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(EVENTS) as WebhookEvent[]).map((e) => (
                    <label key={e} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", events.includes(e) ? "border-accent bg-accent-soft" : "border-border")}>
                      <input type="checkbox" checked={events.includes(e)} onChange={() => setEvents((l) => toggle(l, e))} className="size-4" />{EVENTS[e]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button loading={pending} icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => run(() => createWebhook(url, events), (r) => { if (r.secret) setSecret({ kind: "hook", value: r.secret }); setUrl(""); })}>Ajouter le webhook</Button>
            </div>
          </div>
        </Card>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted"><Code2 className="size-4" aria-hidden="true" />Votre développeur a besoin d&apos;aide ? <a href="mailto:info@skydev.be" className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover"><Mail className="size-4" aria-hidden="true" />info@skydev.be</a> — ou demandez-nous le branchement dans <Link href="/app/sur-mesure" className="font-medium text-accent hover:text-accent-hover">Sur mesure</Link>.</p>
      </section>

      <ConfirmDialog open={!!revoke} title={`Révoquer « ${revoke?.name ?? ""} » ?`} confirmLabel="Révoquer" danger loading={pending} onCancel={() => setRevoke(null)} onConfirm={() => revoke && run(() => revokeApiKey(revoke.id), () => setRevoke(null))}>
        Le site qui utilise cette clé ne pourra plus rien lire ni envoyer, immédiatement. C&apos;est définitif : il faudra créer une nouvelle clé.
      </ConfirmDialog>
      <ConfirmDialog open={!!del} title="Supprimer ce webhook ?" confirmLabel="Supprimer" danger loading={pending} onCancel={() => setDel(null)} onConfirm={() => del && run(() => deleteWebhook(del.id), () => setDel(null))}>
        Votre site ne sera plus prévenu des nouveaux événements.
      </ConfirmDialog>
    </div>
  );
}
