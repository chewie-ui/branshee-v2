"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { sendReviewRequest } from "@/server/actions/google-reviews";

/** Demander un avis à un client (fiche existante ou nouvelle adresse). */
export function ReviewSender({ clients, disabled }: { clients: { id: string; label: string }[]; disabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"client" | "email">(clients.length ? "client" : "email");
  const [customerId, setCustomerId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r: { ok: boolean; message?: string; error?: string } = await sendReviewRequest(mode === "client" ? { customerId } : { email, name }).catch(() => ({ ok: false, error: "Envoi impossible. Vérifiez votre connexion." }));
      setMsg(r.ok ? { ok: true, text: r.message ?? "Envoyé." } : { ok: false, text: r.error ?? "Envoi impossible." });
      if (r.ok) { setCustomerId(""); setEmail(""); setName(""); router.refresh(); }
    });
  };
  return (
    <Card className="p-5">
      <h2 className="font-semibold">Demander un avis</h2>
      <div className="mt-3 inline-flex rounded-lg bg-surface-muted p-1" role="group" aria-label="À qui">
        {clients.length ? <button type="button" aria-pressed={mode === "client"} onClick={() => setMode("client")} className={cn("h-8 rounded-md px-3 text-sm font-medium", mode === "client" ? "bg-surface shadow-sm" : "text-muted hover:text-text")}>Un client</button> : null}
        <button type="button" aria-pressed={mode === "email"} onClick={() => setMode("email")} className={cn("h-8 rounded-md px-3 text-sm font-medium", mode === "email" ? "bg-surface shadow-sm" : "text-muted hover:text-text")}>Une adresse email</button>
      </div>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        {mode === "client" ? (
          <Field label="Client" htmlFor="rv-client" className="sm:col-span-2">
            <Select id="rv-client" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Choisir…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
        ) : (
          <>
            <Field label="Email" htmlFor="rv-email"><Input id="rv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} /></Field>
            <Field label="Prénom (facultatif)" htmlFor="rv-name"><Input id="rv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
          </>
        )}
        <Button type="submit" loading={pending} disabled={disabled || (mode === "client" ? !customerId : !email)} icon={<Send className="size-4" aria-hidden="true" />}>Envoyer</Button>
      </form>
      {msg ? <p className={cn("mt-3 rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
    </Card>
  );
}
