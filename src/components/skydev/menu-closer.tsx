"use client";
import { useEffect } from "react";

/** Ferme les menus déroulants de l'en-tête (langue, menu mobile) au clic à côté ou avec Échap. */
export function MenuCloser() {
  useEffect(() => {
    const close = (keep?: EventTarget | null) => document.querySelectorAll<HTMLDetailsElement>(".sky details.lang-pick[open], .sky details.mnav[open]").forEach((d) => { if (!(keep instanceof Node && d.contains(keep))) d.open = false; });
    const onClick = (e: MouseEvent) => close(e.target);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, []);
  return null;
}
