import type { Metadata } from "next";
import { ListsIndex } from "@/components/todos/lists-index";
import { requireContext } from "@/server/context";
import { teamOf, visibleLists } from "@/server/todos";

export const metadata: Metadata = { title: "Listes · Tâches" };

export default async function Page() {
  const ctx = await requireContext();
  const [lists, team] = await Promise.all([visibleLists(ctx), teamOf(ctx.business.id)]);
  return <ListsIndex lists={lists} team={team} me={ctx.member.id} />;
}
