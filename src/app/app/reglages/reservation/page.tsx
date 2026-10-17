import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingSettings } from "@/db/schema";
import { RulesForm } from "@/components/settings/rules-form";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Règles de réservation · Réglages" };

export default async function BookingRulesPage() {
  const ctx = await requireContext("settings.manage");
  const [s] = await db.select().from(bookingSettings).where(eq(bookingSettings.businessId, ctx.business.id));
  return <RulesForm r={{ slotMode: s!.slotMode, slotIntervalMin: s!.slotIntervalMin, bufferBeforeMin: s!.bufferBeforeMin, bufferAfterMin: s!.bufferAfterMin, minLeadMin: s!.minLeadMin, horizonDays: s!.horizonDays, autoConfirm: s!.autoConfirm, phoneRequired: s!.phoneRequired, firstVisitQuestion: s!.firstVisitQuestion, allowOverbooking: s!.allowOverbooking, waitlistEnabled: s!.waitlistEnabled, smartGrouping: s!.smartGrouping }} />;
}
