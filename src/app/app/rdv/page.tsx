import type { Metadata } from "next";
import { TodayPage } from "@/components/app/today";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("RDV · Aujourd'hui");

export default function Page({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  return TodayPage({ searchParams });
}
