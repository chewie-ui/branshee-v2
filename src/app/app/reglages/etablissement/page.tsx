import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { BusinessForm } from "@/components/settings/business-form";
import { ContactModeForm } from "@/components/settings/contact-mode-form";
import { contactModeOf } from "@/lib/contact-mode";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Établissement · Réglages" };

export default async function BusinessSettingsPage() {
  const ctx = await requireContext("business.manage");
  const [b] = await db.select().from(businesses).where(eq(businesses.id, ctx.business.id));
  return (
    <>
      <BusinessForm
        b={{ name: b!.name, businessType: b!.businessType ?? "", description: b!.description ?? "", email: b!.email ?? "", phone: b!.phone ?? "" }}
      />
      <ContactModeForm mode={contactModeOf(b!.contactMode)} note={b!.contactNote ?? ""} hasPhone={!!b!.phone} />
    </>
  );
}
