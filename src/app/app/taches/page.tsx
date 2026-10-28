import type { Metadata } from "next";
import { TodoPage } from "@/server/todo-page";

export const metadata: Metadata = { title: "Boîte de réception · Tâches" };

/** Boîte de réception : les tâches sans liste (les siennes, ou celles qu'on m'a confiées). */
export default async function Page({ searchParams }: { searchParams: Promise<{ terminees?: string }> }) {
  return <TodoPage view="inbox" title="Boîte de réception" showDone={!!(await searchParams).terminees} />;
}
