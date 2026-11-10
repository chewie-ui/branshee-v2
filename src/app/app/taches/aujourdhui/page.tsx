import type { Metadata } from "next";
import { TodoPage } from "@/server/todo-page";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Aujourd'hui · Tâches");

export default async function Page({ searchParams }: { searchParams: Promise<{ terminees?: string }> }) {
  return <TodoPage view="today" title="Aujourd'hui" showDone={!!(await searchParams).terminees} />;
}
