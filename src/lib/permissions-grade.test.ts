import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_PERMISSIONS, NO_PERMISSIONS, can, gradeWithin, type Permissions } from "./permissions";

const caller = (perms: Permissions, appAccess: string[] | null, isOwner = false) => ({ isOwner, appAccess, can: (k: Parameters<typeof can>[1]) => can(perms, k, isOwner) });
const some = (): Permissions => {
  const p = structuredClone(NO_PERMISSIONS) as Record<string, Record<string, boolean>>;
  const [d, acts] = Object.entries(p)[0]!;
  acts[Object.keys(acts)[0]!] = true;
  void d;
  return p as Permissions;
};

test("gradeWithin : le titulaire peut tout donner", () => {
  assert.equal(gradeWithin({ permissions: ALL_PERMISSIONS, appAccess: null }, caller(NO_PERMISSIONS, null, true)), true);
});

test("gradeWithin : un employé ne peut pas donner plus de droits qu'il n'en a", () => {
  assert.equal(gradeWithin({ permissions: ALL_PERMISSIONS, appAccess: null }, caller(some(), null)), false);
  assert.equal(gradeWithin({ permissions: some(), appAccess: null }, caller(some(), null)), true);
  assert.equal(gradeWithin({ permissions: NO_PERMISSIONS, appAccess: null }, caller(some(), null)), true);
});

test("gradeWithin : pas d'apps en plus des siennes", () => {
  assert.equal(gradeWithin({ permissions: NO_PERMISSIONS, appAccess: null }, caller(ALL_PERMISSIONS, ["rdv"])), false);
  assert.equal(gradeWithin({ permissions: NO_PERMISSIONS, appAccess: ["rdv", "factures"] }, caller(ALL_PERMISSIONS, ["rdv"])), false);
  assert.equal(gradeWithin({ permissions: NO_PERMISSIONS, appAccess: ["rdv"] }, caller(ALL_PERMISSIONS, ["rdv", "factures"])), true);
});
