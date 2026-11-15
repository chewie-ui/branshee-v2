"use client";
import { usePathname } from "next/navigation";

/**
 * Chemin de la page dans l'espace, toujours sous sa forme interne : sur pro.skydev.be l'adresse affichée est courte
 * (« /agenda »), mais les menus comparent avec « /app/agenda ». Sur skydev.be (ou branshee.com) rien ne change.
 */
export function useSpacePath(prefix: "/app" | "/espace-client" = "/app") {
  const p = usePathname() ?? "";
  if (p === prefix || p.startsWith(`${prefix}/`)) return p;
  return p === "/" ? prefix : prefix + p;
}
