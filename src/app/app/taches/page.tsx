import type { Metadata } from "next";
import { TodoPage } from "@/server/todo-page";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Boîte de réception · Tâches");

/** Boîte de réception : les tâches sans liste (les siennes, ou celles qu'on m'a confiées). */
export default async function Page({ searchParams }: { searchParams: Promise<{ terminees?: string }> }) {
  const t = await appT();
  return <TodoPage view="inbox" title={t("Boîte de réception")} showDone={!!(await searchParams).terminees} />;
}
