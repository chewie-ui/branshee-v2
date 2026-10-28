import type { Metadata } from "next";
import { TodoPage } from "@/server/todo-page";

export const metadata: Metadata = { title: "Aujourd'hui · Tâches" };

export default async function Page({ searchParams }: { searchParams: Promise<{ terminees?: string }> }) {
  return <TodoPage view="today" title="Aujourd'hui" showDone={!!(await searchParams).terminees} />;
}
