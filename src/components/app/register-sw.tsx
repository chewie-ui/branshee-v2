"use client";

import { useEffect } from "react";

/** Enregistre le service worker (application installable). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
