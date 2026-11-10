"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { sendContact, type ContactState } from "@/server/actions/contact";

const NEEDS = ["Website", "Online store", "Web app / SaaS", "Mobile app", "Automation / AI", "Skydev apps"];

/** Formulaire de contact du site anglais (mêmes règles que le français, messages en anglais). */
export function ContactFormEn() {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, undefined);
  const [needs, setNeeds] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState("");
  const [phone, setPhone] = useState("");
  const err = state?.fieldErrors ?? {};
  const picked = NEEDS.filter((n) => needs.has(n));
  const message = [picked.length ? `Interested in: ${picked.join(", ")}` : null, phone.trim() ? `Phone: ${phone.trim()}` : null, "Language: English", "", details.trim() || "I'd like to receive an estimate."].filter((l) => l !== null).join("\n");
  const toggle = (n: string) => setNeeds((p) => { const s = new Set(p); if (s.has(n)) s.delete(n); else s.add(n); return s; });

  if (state?.ok)
    return <div className="form"><div className="done" role="status"><CheckCircle2 className="ico" aria-hidden="true" /><b style={{ fontSize: 18 }}>Request sent</b><p className="muted" style={{ margin: 0 }}>Thank you! I&apos;ll reply by email within 24 hours.</p></div></div>;

  return (
    <form className="form" action={action} noValidate>
      {state?.error ? <p className="alert" role="alert">{state.error}</p> : null}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sel" style={{ marginBottom: 10 }}>What do you need? (optional)</legend>
        <ul className="ideas" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {NEEDS.map((n) => <li key={n}><button type="button" className="chip" aria-pressed={needs.has(n)} onClick={() => toggle(n)}>{n}</button></li>)}
        </ul>
      </fieldset>
      <input type="hidden" name="lang" value="en" />
      <input type="hidden" name="subject" value={`Skydev request (EN)${picked.length ? ` — ${picked.join(", ")}` : ""}`} />
      <input type="hidden" name="message" value={message} />
      <div className="hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="row2">
        <label className="f">Name<input id="c-name" name="name" autoComplete="name" defaultValue={state?.values?.name} aria-invalid={!!err.name || undefined} />{err.name ? <span className="err">{err.name}</span> : null}</label>
        <label className="f">Email<input name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} aria-invalid={!!err.email || undefined} />{err.email ? <span className="err">{err.email}</span> : null}</label>
      </div>
      <label className="f">Phone (optional)<input name="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="f">Your project (optional)<textarea className="t" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="E.g. I run a yoga studio in Lisbon and want a website where clients can book classes." /></label>
      {err.message ? <span className="err">{err.message}</span> : null}
      <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending || undefined}>{pending ? "Sending…" : "Send my request"}</button>
    </form>
  );
}
