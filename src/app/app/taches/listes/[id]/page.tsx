import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TodoPage } from "@/server/todo-page";

export const metadata: Metadata = { title: "Liste · Tâches" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ terminees?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const page = await TodoPage({ view: "list", title: "Liste", showDone: !!(await searchParams).terminees, listId: id });
  if (!page) notFound();
  return page;
}
