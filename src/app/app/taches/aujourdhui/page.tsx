import type { Metadata } from "next";
import { TodoPage } from "@/server/todo-page";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Aujourd'hui · Tâches");

export default async function Page({ searchParams }: { searchParams: Promise<{ terminees?: string }> }) {
  const t = await appT();
  return <TodoPage view="today" title={t("Aujourd'hui")} showDone={!!(await searchParams).terminees} />;
}
