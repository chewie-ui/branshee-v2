import { redirect } from "next/navigation";
import { requireContext } from "@/server/context";
import { currentBrand } from "@/server/brand";

export default async function SettingsIndex() {
  const ctx = await requireContext();
  redirect(ctx.can("business.manage") ? "/app/reglages/etablissement" : (await currentBrand()).id === "skydev" ? "/app/rdv/parametres" : "/app/reglages/reservation");
}
