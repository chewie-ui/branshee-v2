"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Plus, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DOT, ListDialog, type TodoList } from "./todo-board";

/** Toutes les listes visibles, et création d'une nouvelle. */
export function ListsIndex({ lists, team, me }: { lists: TodoList[]; team: { id: string; name: string }[]; me: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Listes</h1>
        <Button className="ml-auto" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>Nouvelle liste</Button>
      </div>
      {!lists.length ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
          <p className="font-medium text-text">Aucune liste pour l&apos;instant</p>
          <p className="mx-auto mt-1 max-w-sm">Une liste par chantier, par client ou par sujet (« Admin », « Courses »…). Partagez-la avec toute l&apos;équipe ou gardez-la pour vous.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/app/taches/listes/${l.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent">
                <span className={cn("size-3 shrink-0 rounded-full", DOT[l.color] ?? DOT.slate)} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
                {l.visibility === "team" ? <Users className="size-4 text-muted" aria-label="Toute l'équipe" /> : l.visibility === "private" ? <Lock className="size-4 text-muted" aria-label="Privée" /> : <UserRound className="size-4 text-muted" aria-label="Partagée" />}
                <span className="text-sm text-muted tabular-nums">{l.open}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open ? <ListDialog team={team} me={me} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
