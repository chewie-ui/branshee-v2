import "server-only";
import { TodoBoard, type TodoTask } from "@/components/todos/todo-board";
import { todayIn } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { listMembersOf, tasksFor, teamOf, visibleLists, type TodoView } from "@/server/todos";

const ser = (t: { completedAt: Date | null } & Omit<TodoTask, "completedAt">): TodoTask => ({ ...t, completedAt: t.completedAt?.toISOString() ?? null });

/** Rendu commun des vues de l'app Tâches. */
export async function TodoPage({ view, title, showDone, listId }: { view: TodoView["kind"]; title: string; showDone: boolean; listId?: string }) {
  const ctx = await requireContext();
  const today = todayIn(ctx.business.timezone);
  const lists = await visibleLists(ctx);
  const list = listId ? lists.find((l) => l.id === listId) : undefined;
  if (listId && !list) return null;
  const [{ top, subs }, team, memberIds] = await Promise.all([tasksFor(ctx, list ? { kind: "list", id: list.id } : ({ kind: view } as TodoView), today, showDone), teamOf(ctx.business.id), list ? listMembersOf(list.id) : Promise.resolve([])]);
  return (
    <TodoBoard
      title={list?.name ?? title}
      view={view as "inbox" | "today" | "upcoming" | "list"}
      tasks={top.map(ser)}
      subs={subs.map(ser)}
      lists={lists}
      team={team}
      today={today}
      me={ctx.member.id}
      list={list ? { ...list, memberIds } : undefined}
      canEditList={!!list && (ctx.member.isOwner || ctx.can("settings.manage") || list.createdBy === ctx.member.id)}
      showDone={showDone}
    />
  );
}
