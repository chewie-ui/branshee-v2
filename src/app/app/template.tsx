import type { ReactNode } from "react";
import { headers } from "next/headers";
import { APPS, appForPath } from "@/lib/apps";
import { requireContext } from "@/server/context";
import AccessDeniedPage from "./acces-refuse/page";

/**
 * Rendu à chaque page de l'espace pro : une app fermée au grade du membre (Grades › apps accessibles)
 * affiche « accès refusé » au lieu de son contenu, même en tapant l'adresse.
 */
export default async function AppTemplate({ children }: { children: ReactNode }) {
  const ctx = await requireContext();
  if (!ctx.appAccess) return children;
  const path = (await headers()).get("x-pathname") ?? "";
  const app = appForPath(APPS, path);
  if (app && app.id !== "reglages" && !ctx.canApp(app.id)) return <AccessDeniedPage />;
  return children;
}
