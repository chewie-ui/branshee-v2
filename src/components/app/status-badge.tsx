import { Badge } from "@/components/ui/badge";
import { appT } from "@/server/app-locale";

export async function StatusBadge({ status }: { status: "pending" | "confirmed" | "cancelled" }) {
  const t = await appT();
  if (status === "pending") return <Badge tone="warning">{t("À confirmer")}</Badge>;
  if (status === "cancelled") return <Badge tone="danger">Annulé</Badge>;
  return <Badge tone="success">Confirmé</Badge>;
}
