"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveError } from "@/server/actions/admin-health";

export function ResolveErrorButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="secondary" loading={pending} icon={<Check className="size-4" aria-hidden="true" />} onClick={() => start(async () => { await resolveError(id); router.refresh(); })}>
      {label}
    </Button>
  );
}
