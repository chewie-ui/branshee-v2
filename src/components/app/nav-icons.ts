import { ChartColumn, FilePen, Package, Blocks, CalendarDays, Clock, CreditCard, FileText, Globe, History, Inbox, LayoutGrid, LayoutTemplate, LifeBuoy, PhoneCall, Scissors, Settings, ShoppingBag, Sun, UserRound, Users, WandSparkles } from "lucide-react";
import type { NavItem } from "@/lib/navigation";

/** Icônes des menus de l'espace pro (barre latérale Branshee, onglets d'app Skydev). */
export const NAV_ICONS: Record<NavItem["icon"], typeof Sun> = {
  today: Sun,
  inbox: Inbox,
  history: History,
  calendar: CalendarDays,
  users: UserRound,
  scissors: Scissors,
  team: Users,
  clock: Clock,
  globe: Globe,
  layout: LayoutTemplate,
  blocks: Blocks,
  settings: Settings,
  help: LifeBuoy,
  apps: LayoutGrid,
  file: FileText,
  card: CreditCard,
  phone: PhoneCall,
  bag: ShoppingBag,
  wand: WandSparkles,
  chart: ChartColumn,
  quote: FilePen,
  package: Package,
};
