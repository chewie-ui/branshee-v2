"use client";

import { useEffect } from "react";

/**
 * Page affichée dans une iframe (site du pro) : on transmet sa hauteur au parent.
 * Même message que l'ancien Branshee (`branshee-resize`), pour que les codes
 * d'intégration déjà collés sur les sites des pros continuent de fonctionner.
 */
export function EmbedResize() {
  useEffect(() => {
    if (window.self === window.top) return;
    let last = 0;
    const post = () => {
      const h = Math.ceil(document.documentElement.scrollHeight);
      if (Math.abs(h - last) < 4) return;
      last = h;
      window.parent.postMessage({ type: "branshee-resize", height: h }, "*");
    };
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    post();
    return () => ro.disconnect();
  }, []);
  return null;
}

type Msg = { type: "branshee-theme"; vars: Record<string, string>; font: string | null; texts: { calendarHelp: string; slotHeading: string; timezone: string }; bgImage: string; layout: "classic" | "split" };

const DEFAULT_TEXT: Record<string, string> = { slotHeading: "Choisissez un créneau" };

/**
 * Aperçu en direct depuis l'éditeur d'apparence (même origine uniquement) :
 * applique le thème reçu sans recharger la page.
 */
export function ThemePreview() {
  useEffect(() => {
    let texts: Msg["texts"] | null = null;
    const applyTexts = () => {
      if (!texts) return;
      document.querySelectorAll<HTMLElement>("[data-theme-text]").forEach((el) => {
        const k = el.dataset.themeText as keyof Msg["texts"];
        const v = texts![k] || DEFAULT_TEXT[k] || "";
        if (el.textContent !== v) el.textContent = v;
        el.hidden = !v;
      });
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== "branshee-theme") return;
      const m = e.data as Msg;
      const root = document.getElementById("bp-root");
      if (!root) return;
      for (const [k, v] of Object.entries(m.vars)) root.style.setProperty(k, v);
      root.style.backgroundImage = m.bgImage ? `url("${m.bgImage.replace(/"/g, "")}")` : "";
      root.dataset.layout = m.layout;
      let link = document.getElementById("bp-font-preview") as HTMLLinkElement | null;
      if (m.font) {
        if (!link) {
          link = document.createElement("link");
          link.id = "bp-font-preview";
          link.rel = "stylesheet";
          document.head.appendChild(link);
        }
        if (link.href !== m.font) link.href = m.font;
      }
      texts = m.texts;
      applyTexts();
    };
    const mo = new MutationObserver(applyTexts);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("message", onMsg);
      mo.disconnect();
    };
  }, []);
  return null;
}
