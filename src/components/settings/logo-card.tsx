"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/app-locale";
import { saveBusinessLogo } from "@/server/actions/business";

/** Photo ou logo de l'établissement : affiché en haut de la page publique et dans l'annuaire. */
export function LogoCard({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(photoUrl);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const send = (fd: FormData) =>
    start(async () => {
      const r = await saveBusinessLogo(fd).catch(() => ({ ok: false as const, error: t("Connexion impossible. Réessayez.") }));
      if (r.ok) { setMsg({ ok: true, text: t("Enregistré.") }); router.refresh(); }
      else { setMsg({ ok: false, text: r.error }); setPreview(photoUrl); }
    });
  return (
    <Card>
      <CardHeader title={t("Photo ou logo")} description={t("Affiché en haut de votre page et dans l'annuaire. JPG, PNG ou WebP, 5 Mo maximum.")} />
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-muted text-2xl font-semibold text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt={t("Logo actuel")} className="size-full object-cover" /> : name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={t("Choisir une image")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setPreview(URL.createObjectURL(f));
              const fd = new FormData();
              fd.set("photo", f);
              send(fd);
              e.target.value = "";
            }}
          />
          <Button type="button" onClick={() => input.current?.click()} disabled={pending}><ImagePlus className="size-4" aria-hidden="true" />{pending ? t("Envoi…") : preview ? t("Changer l'image") : t("Ajouter une photo ou un logo")}</Button>
          {preview ? <Button type="button" variant="secondary" disabled={pending} onClick={() => { const fd = new FormData(); fd.set("removePhoto", "1"); setPreview(null); send(fd); }}><Trash2 className="size-4" aria-hidden="true" />{t("Retirer")}</Button> : null}
        </div>
        {msg ? <p className={`w-full text-sm ${msg.ok ? "text-success" : "text-danger"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      </div>
    </Card>
  );
}
