import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: "pending" | "confirmed" | "cancelled" }) {
  if (status === "pending") return <Badge tone="warning">À confirmer</Badge>;
  if (status === "cancelled") return <Badge tone="danger">Annulé</Badge>;
  return <Badge tone="success">Confirmé</Badge>;
}
