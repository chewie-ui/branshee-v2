"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Vrai quand la page est affichée dans une iframe (calendrier intégré sur le site d'un pro). */
export function useEmbedded() {
  return useSyncExternalStore(
    noop,
    () => {
      try {
        return window.self !== window.top;
      } catch {
        return true; // accès refusé au parent = autre domaine, donc intégré
      }
    },
    () => false,
  );
}
