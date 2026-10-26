import type { Metadata } from "next";
import { TodayPage } from "@/components/app/today";

export const metadata: Metadata = { title: "RDV · Aujourd'hui" };

export default function Page({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  return TodayPage({ searchParams });
}
