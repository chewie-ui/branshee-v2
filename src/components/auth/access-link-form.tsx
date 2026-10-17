"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { redeemAccessLink } from "@/server/actions/access-links";

export function AccessLinkForm({ code, businesses }: { code: string; businesses: { id: string; name: string }[] }) {
  const [biz, setBiz] = useState(businesses[0]!.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await redeemAccessLink(code, biz); if (r && !r.ok) setError(r.error); }); }}>
      {businesses.length > 1 ? (
        <Field label="Pour quel établissement ?" htmlFor="biz">
          <Select id="biz" value={biz} onChange={(e) => setBiz(e.target.value)}>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        </Field>
      ) : <p className="text-sm">Pour <span className="font-medium">{businesses[0]!.name}</span></p>}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <Button type="submit" loading={pending} className="w-full">Activer mon accès</Button>
    </form>
  );
}
