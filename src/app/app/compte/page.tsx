import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { DeleteAccountCard, EmailCard, LanguageCard, PasswordCard, ProfileCard, TwoFactorCard } from "@/components/account/account-settings";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  await requireContext();
  const u = (await getSessionUser())!.user;
  const [owned] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.ownerId, u.id), isNull(businesses.deletedAt))).limit(1);
  return (
    <>
      <PageHeader title="Mon compte" description="Vos informations personnelles et la sécurité de votre compte." />
      <div className="mx-auto max-w-3xl space-y-6">
        <ProfileCard client={false} p={{ fullName: u.fullName, email: u.email, avatarUrl: u.avatarUrl, phone: u.phone ?? "", gender: u.gender ?? "", birthDate: u.birthDate ?? "", address: u.address ?? "", postalCode: u.postalCode ?? "", city: u.city ?? "", country: u.country ?? "", emailNotifications: u.emailNotifications }} />
        <EmailCard email={u.email} hasPassword={!!u.passwordHash} />
        <PasswordCard hasPassword={!!u.passwordHash} />
        <TwoFactorCard enabled={!!u.twoFactorSecret} />
        <LanguageCard locale={u.locale} />
        <DeleteAccountCard hasPassword={!!u.passwordHash} ownsBusiness={!!owned} />
      </div>
    </>
  );
}
