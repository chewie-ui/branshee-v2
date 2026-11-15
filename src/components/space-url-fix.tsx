"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sur pro.skydev.be / client.skydev.be, remplace dans la barre d'adresse une adresse longue (/app/agenda)
 * par sa forme courte (/agenda) après une navigation interne (lien, redirection d'une action).
 */
export function SpaceUrlFix() {
  const path = usePathname();
  useEffect(() => {
    const m = /^(pro|client)\.skydev\./.exec(window.location.hostname);
    if (!m) return;
    const prefix = m[1] === "pro" ? "/app" : "/espace-client";
    const cur = window.location.pathname;
    if (cur === prefix || cur.startsWith(`${prefix}/`)) window.history.replaceState(null, "", (cur.slice(prefix.length) || "/") + window.location.search + window.location.hash);
  }, [path]);
  return null;
}
