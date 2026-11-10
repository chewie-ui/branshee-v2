import type { Metadata } from "next";
import { TodoPage } from "@/server/todo-page";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("À venir · Tâches");

export default async function Page({ searchParams }: { searchParams: Promise<{ terminees?: string }> }) {
  return <TodoPage view="upcoming" title="À venir" showDone={!!(await searchParams).terminees} />;
}
