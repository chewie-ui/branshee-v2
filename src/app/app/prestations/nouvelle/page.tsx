import type { Metadata } from "next";
import { ServiceForm } from "@/components/services/service-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { serviceFormData } from "@/server/services-page";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Nouvelle prestation");

export default async function NewServicePage() {
  const t = await appT();
  const ctx = await requireContext("services.manage");
  const data = await serviceFormData(ctx.business.id);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Nouvelle prestation")} />
      <ServiceForm
        {...data}
        initial={{ id: null, name: "", description: "", categoryId: "", durationMin: 30, price: "", color: "#4f46e5", audience: "all", isActive: true, memberIds: [], kind: "individual", capacity: null, blocksIndividual: true, hours: {}, durationMaxMin: null, location: "", imageUrl: null, fee: null }}
      />
    </div>
  );
}
