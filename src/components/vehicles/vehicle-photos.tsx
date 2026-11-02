"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { addVehiclePhoto, removeVehiclePhoto, reorderVehiclePhotos } from "@/server/actions/vehicles";

const MAX_SIDE = 2000;

/** Réduit une photo de téléphone (souvent 4 à 10 Mo) à 2000 px de côté en JPEG : envoi rapide, page légère. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

/** Galerie du véhicule : ajout (plusieurs à la fois), ordre, photo principale, suppression. */
export function VehiclePhotos({ id, photos, canManage, highlight = false }: { id: string; photos: string[]; canManage: boolean; highlight?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [list, setList] = useState(photos);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    const arr = [...files];
    for (let i = 0; i < arr.length; i++) {
      setBusy(`Envoi de la photo ${i + 1} sur ${arr.length}…`);
      const fd = new FormData();
      fd.set("photo", await shrink(arr[i]!), arr[i]!.name.replace(/\.\w+$/, ".jpg"));
      const r = await addVehiclePhoto(id, fd);
      if (!r.ok) { setErr(r.error); break; }
      if (r.url) setList((l) => [...l, r.url!]);
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    router.refresh();
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setList(next);
    start(async () => { const r = await reorderVehiclePhotos(id, next); if (!r.ok) setErr(r.error); });
  };
  const main = (i: number) => {
    const next = [list[i]!, ...list.filter((_, k) => k !== i)];
    setList(next);
    start(async () => { const r = await reorderVehiclePhotos(id, next); if (!r.ok) setErr(r.error); });
  };
  const remove = (url: string) => {
    if (!window.confirm("Supprimer cette photo ?")) return;
    setList((l) => l.filter((p) => p !== url));
    start(async () => { const r = await removeVehiclePhoto(id, url); if (!r.ok) setErr(r.error); });
  };

  return (
    <Card className={highlight ? "ring-2 ring-accent" : undefined}>
      <CardHeader
        title={`Photos (${list.length}/30)`}
        description="La première est la photo principale. Prenez-les de face, 3/4, profil, arrière, intérieur, tableau de bord et compteur."
        action={canManage ? (
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
            <ImagePlus className="size-4" aria-hidden="true" />Ajouter
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={!!busy} />
          </label>
        ) : undefined}
      />
      <div className="p-5">
        {busy ? <p className="mb-3 text-sm text-muted" role="status">{busy}</p> : null}
        {err ? <p className="mb-3 text-sm text-danger" role="alert">{err}</p> : null}
        {list.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((p, i) => (
              <li key={p} className="group relative overflow-hidden rounded-xl border border-border bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- photos téléversées (/media) */}
                <img src={p} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                {i === 0 ? <span className="absolute top-2 left-2 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Principale</span> : null}
                {canManage ? (
                  <div className="flex items-center justify-between gap-1 border-t border-border bg-surface p-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30" aria-label="Déplacer vers la gauche"><ArrowLeft className="size-4" aria-hidden="true" /></button>
                    {i > 0 ? <button type="button" onClick={() => main(i)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label="Choisir comme photo principale" title="Photo principale"><Star className="size-4" aria-hidden="true" /></button> : null}
                    <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30" aria-label="Déplacer vers la droite"><ArrowRight className="size-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => remove(p)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" aria-label="Supprimer la photo"><Trash2 className="size-4" aria-hidden="true" /></button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <button type="button" onClick={() => input.current?.click()} disabled={!canManage || !!busy} className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border-strong px-6 py-10 text-sm text-muted hover:border-accent hover:text-text">
            <ImagePlus className="size-8" aria-hidden="true" />
            Ajoutez les photos du véhicule (plusieurs à la fois)
          </button>
        )}
      </div>
    </Card>
  );
}
