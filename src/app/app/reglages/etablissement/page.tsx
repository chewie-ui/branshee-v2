import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { BusinessForm } from "@/components/settings/business-form";
import { LogoCard } from "@/components/settings/logo-card";
import { ContactModeForm } from "@/components/settings/contact-mode-form";
import { contactModeOf } from "@/lib/contact-mode";
import { requireContext } from "@/server/context";
import { CountryForm } from "@/components/settings/country-form";
import { countryOptions } from "@/lib/countries";
import { currentBrand } from "@/server/brand";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Établissement · Réglages");

export default async function BusinessSettingsPage() {
  const ctx = await requireContext("business.manage");
  const [b] = await db.select().from(businesses).where(eq(businesses.id, ctx.business.id));
  return (
    <>
      <div id="logo"><LogoCard photoUrl={b!.photoUrl} name={b!.name} /></div>
      <BusinessForm
        b={{ name: b!.name, businessType: b!.businessType ?? "", description: b!.description ?? "", email: b!.email ?? "", phone: b!.phone ?? "" }}
      />
      <ContactModeForm mode={contactModeOf(b!.contactMode)} note={b!.contactNote ?? ""} hasPhone={!!b!.phone} />
      {(await currentBrand()).id === "skydev" ? <CountryForm country={b!.countryCode} options={countryOptions(ctx.user.locale ?? "fr")} /> : null}
    </>
  );
}
