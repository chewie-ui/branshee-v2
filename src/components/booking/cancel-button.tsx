"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelByToken } from "@/server/actions/manage";
import { useI18n } from "@/i18n/client";

export function CancelButton({ token }: { token: string }) {
  const { t, tr } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <Button variant="secondary" className="w-full" onClick={() => setConfirming(true)}>
        {t("manage.cancelAppointment")}
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-lg border border-danger/30 bg-danger-soft p-4">
      <p className="text-sm font-medium text-danger">{t("manage.cancelConfirm")}</p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending} className="flex-1">
          {t("manage.keep")}
        </Button>
        <Button
          variant="danger"
          loading={pending}
          className="flex-1"
          onClick={() =>
            start(async () => {
              const res = await cancelByToken(token);
              if (!res.ok) setError(res.error ? tr(res.error) : t("common.error"));
            })
          }
        >
          {t("manage.yesCancel")}
        </Button>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
    </div>
  );
}
