import { UsersRound } from "lucide-react";
import type { AppIcon as AppIconName } from "@/lib/apps";
import { NAV_ICONS } from "@/components/app/nav-icons";
import { cn } from "@/lib/cn";

/** Icône d'une app Skydev : mêmes icônes que les menus, « users » en version équipe. */
export function AppIcon({ icon, className }: { icon: AppIconName; className?: string }) {
  const Icon = icon === "users" ? UsersRound : NAV_ICONS[icon];
  return <Icon className={cn("size-5", className)} strokeWidth={1.75} aria-hidden="true" />;
}
