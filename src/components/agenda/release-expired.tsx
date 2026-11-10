"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { releaseExpiredRequests } from "@/server/actions/appointments";
import { useT } from "@/components/app-locale";

export function ReleaseAllExpired({ count }: { count: number }) {
  const t = useT();
  const [pending, start] = useTransition();
  if (count < 2) return null;
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => void (await releaseExpiredRequests()))}>
      {t("Tout libérer")}
    </Button>
  );
}
