import type { Metadata } from "next";
import { TodoPage } from "@/server/todo-page";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("À venir · Tâches");

export default async function Page({ searchParams }: { searchParams: Promise<{ terminees?: string }> }) {
  const t = await appT();
  return <TodoPage view="upcoming" title={t("À venir")} showDone={!!(await searchParams).terminees} />;
}
