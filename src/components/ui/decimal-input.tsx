"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/field";

const parse = (s: string) => {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const show = (n: number) => (n ? String(n).replace(".", ",") : "0");

/**
 * Montant ou quantité à virgule : on tape « 12,50 » ou « 12.50 » librement (le texte n'est pas réécrit
 * pendant la saisie), la valeur numérique remonte à chaque frappe.
 */
export function DecimalInput({ value, onValue, ...props }: { value: number; onValue: (n: number) => void } & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  const [text, setText] = useState(show(value));
  // Valeur changée de l'extérieur (article du catalogue, duplication) : on suit.
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    if (parse(text) !== value) setText(show(value));
  }
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d,.\-\s]/g, "");
        setText(t);
        const n = parse(t);
        setLast(n);
        onValue(n);
      }}
      onBlur={() => setText(show(parse(text)))}
    />
  );
}
