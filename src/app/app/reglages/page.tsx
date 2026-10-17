import { redirect } from "next/navigation";
import { requireContext } from "@/server/context";

export default async function SettingsIndex() {
  const ctx = await requireContext();
  redirect(ctx.can("business.manage") ? "/app/reglages/etablissement" : "/app/reglages/reservation");
}
