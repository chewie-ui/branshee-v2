import type { Metadata } from "next";
import { ListsIndex } from "@/components/todos/lists-index";
import { requireContext } from "@/server/context";
import { teamOf, visibleLists } from "@/server/todos";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Listes · Tâches");

export default async function Page() {
  const ctx = await requireContext();
  const [lists, team] = await Promise.all([visibleLists(ctx), teamOf(ctx.business.id)]);
  return <ListsIndex lists={lists} team={team} me={ctx.member.id} />;
}
