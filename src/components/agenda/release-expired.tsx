"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { releaseExpiredRequests } from "@/server/actions/appointments";

export function ReleaseAllExpired({ count }: { count: number }) {
  const [pending, start] = useTransition();
  if (count < 2) return null;
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => void (await releaseExpiredRequests()))}>
      Tout libérer
    </Button>
  );
}
