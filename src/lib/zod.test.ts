import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "./zod";

test("messages zod en français", () => {
  assert.equal(z.coerce.number().safeParse("abc").error?.issues[0]?.message, "Indiquez un nombre valide.");
  assert.equal(z.number().min(0).safeParse(-20).error?.issues[0]?.message, "Le nombre ne peut pas être négatif.");
  assert.equal(z.string().min(1).safeParse("").error?.issues[0]?.message, "Ce champ est obligatoire.");
  assert.equal(z.string().email().safeParse("x").error?.issues[0]?.message, "Adresse e-mail invalide.");
  // Message propre à un schéma : il garde la priorité.
  assert.equal(z.string().min(1, "Nom requis").safeParse("").error?.issues[0]?.message, "Nom requis");
});
