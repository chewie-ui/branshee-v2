"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Mesure d'audience maison (aucun service tiers) : une vue par page, avec la source (UTM / référent).
 * Le visiteur est identifié côté serveur par une empreinte quotidienne non réversible, sans cookie.
 */
function TrackInner() {
  const path = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    const body = JSON.stringify({
      path,
      source: params.get("utm_source") ?? undefined,
      medium: params.get("utm_medium") ?? undefined,
      campaign: params.get("utm_campaign") ?? undefined,
      term: params.get("utm_term") ?? undefined,
      content: params.get("utm_content") ?? undefined,
      gclid: params.get("gclid") ?? undefined,
      referrer: document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : undefined,
    });
    try {
      if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    } catch {
      /* mesure facultative */
    }
  }, [path, params]);
  return null;
}

export function Track() {
  return (
    <Suspense fallback={null}>
      <TrackInner />
    </Suspense>
  );
}
