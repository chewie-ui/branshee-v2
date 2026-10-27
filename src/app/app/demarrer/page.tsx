import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { AppSetup } from "@/components/apps/app-setup";
import { currentBrand } from "@/server/brand";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Bien démarrer" };

/** Skydev : questionnaire de départ (aussi relançable depuis l'accueil pour changer ses apps). */
export default async function SetupPage() {
  if ((await currentBrand()).id !== "skydev") redirect("/app");
  const ctx = await requireContext();
  if (!ctx.member.isOwner && !ctx.can("settings.manage")) redirect("/app");
  const [b] = await db.select({ o: businesses.onboarding }).from(businesses).where(eq(businesses.id, ctx.business.id));
  return <AppSetup firstName={ctx.user.name.split(" ")[0] ?? ""} initial={{ teamSize: b?.o.teamSize, needs: b?.o.needs }} />;
}
