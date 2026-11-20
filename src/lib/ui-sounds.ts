"use client";

import type { SoundId } from "@/lib/ui-prefs";

/**
 * Sons de notification synthétisés (Web Audio) : aucun fichier à charger, rendu identique partout.
 * Le navigateur n'autorise le son qu'après une première interaction avec la page : le contexte audio
 * est créé à la demande et réveillé au premier clic.
 */
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** À appeler une fois au chargement : réveille l'audio au premier geste de l'utilisateur. */
export function unlockAudioOnGesture() {
  if (typeof window === "undefined") return () => {};
  const on = () => {
    audio();
    window.removeEventListener("pointerdown", on);
    window.removeEventListener("keydown", on);
  };
  window.addEventListener("pointerdown", on, { once: true });
  window.addEventListener("keydown", on, { once: true });
  return () => {
    window.removeEventListener("pointerdown", on);
    window.removeEventListener("keydown", on);
  };
}

type Note = { f: number; t: number; d: number; type?: OscillatorType; g?: number; slide?: number };

const PRESETS: Record<SoundId, Note[]> = {
  bulle: [{ f: 520, t: 0, d: 0.12, slide: 980, g: 0.9 }, { f: 880, t: 0.09, d: 0.1, slide: 1320, g: 0.5 }],
  carillon: [{ f: 880, t: 0, d: 0.5 }, { f: 1318.5, t: 0.14, d: 0.7 }],
  cloche: [{ f: 1568, t: 0, d: 1.1, type: "triangle", g: 0.8 }, { f: 3136, t: 0, d: 0.5, g: 0.2 }],
  douce: [{ f: 523.25, t: 0, d: 0.6, g: 0.6 }, { f: 659.25, t: 0.08, d: 0.6, g: 0.5 }, { f: 783.99, t: 0.16, d: 0.7, g: 0.45 }],
  arcade: [{ f: 660, t: 0, d: 0.08, type: "square", g: 0.35 }, { f: 990, t: 0.09, d: 0.12, type: "square", g: 0.35 }],
};

/** Joue un son à un volume de 0 à 100. */
export function playSound(id: SoundId, volume = 70) {
  const ac = audio();
  if (!ac || volume <= 0) return;
  const master = ac.createGain();
  master.gain.value = Math.min(volume, 100) / 100 * 0.35;
  master.connect(ac.destination);
  const now = ac.currentTime + 0.02;
  for (const n of PRESETS[id] ?? PRESETS.bulle) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = n.type ?? "sine";
    o.frequency.setValueAtTime(n.f, now + n.t);
    if (n.slide) o.frequency.exponentialRampToValueAtTime(n.slide, now + n.t + n.d * 0.8);
    g.gain.setValueAtTime(0.0001, now + n.t);
    g.gain.exponentialRampToValueAtTime(n.g ?? 0.7, now + n.t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
    o.connect(g).connect(master);
    o.start(now + n.t);
    o.stop(now + n.t + n.d + 0.05);
  }
  setTimeout(() => master.disconnect(), 2000);
}
