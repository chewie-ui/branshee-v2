import { BookUser, CalendarDays, FileText, Globe, PhoneCall, Settings, ShoppingBag, UsersRound, WandSparkles } from "lucide-react";
import type { AppIcon as AppIconName } from "@/lib/apps";
import { cn } from "@/lib/cn";

const ICONS = { calendar: CalendarDays, globe: Globe, file: FileText, users: UsersRound, bag: ShoppingBag, phone: PhoneCall, wand: WandSparkles, contacts: BookUser, settings: Settings } as const;

export function AppIcon({ icon, className }: { icon: AppIconName; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={cn("size-5", className)} strokeWidth={1.75} aria-hidden="true" />;
}
