import type { Metadata } from "next";
import { DeleteAccountCard, EmailCard, LanguageCard, PasswordCard, ProfileCard } from "@/components/account/account-settings";
import { requireClient, isPro } from "@/server/client-account";

export const metadata: Metadata = { title: "Paramètres" };

export default async function ClientSettings() {
  const u = await requireClient("/espace-client/parametres");
  const pro = await isPro(u.id);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
      <ProfileCard client p={{ fullName: u.fullName, email: u.email, avatarUrl: u.avatarUrl, phone: u.phone ?? "", gender: u.gender ?? "", birthDate: u.birthDate ?? "", address: u.address ?? "", postalCode: u.postalCode ?? "", city: u.city ?? "", country: u.country ?? "", emailNotifications: u.emailNotifications }} />
      <EmailCard email={u.email} hasPassword={!!u.passwordHash} />
      <PasswordCard hasPassword={!!u.passwordHash} />
      <LanguageCard locale={u.locale} />
      <DeleteAccountCard hasPassword={!!u.passwordHash} ownsBusiness={pro} />
    </div>
  );
}
