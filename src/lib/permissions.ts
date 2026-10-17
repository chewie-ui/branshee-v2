/**
 * Permissions des grades — source unique de vérité.
 * Reprend exactement les permissions de l'ancien `CompanyGrade`, regroupées
 * par domaine. Le propriétaire de l'établissement a toujours tout.
 */
export const PERMISSIONS = {
  appointments: { label: "Rendez-vous", actions: { view: "Voir l'agenda", manage: "Créer et modifier", cancel: "Annuler et supprimer" } },
  customers: { label: "Clients", actions: { view: "Voir les fiches", manage: "Modifier les fiches et dossiers" } },
  services: { label: "Prestations", actions: { view: "Voir", manage: "Créer et modifier" } },
  groupSessions: { label: "Cours collectifs", actions: { view: "Voir", manage: "Créer et modifier" } },
  availability: {
    label: "Horaires et congés",
    actions: {
      manageShared: "Horaires de l'établissement",
      manageOwnSchedule: "Ses propres horaires",
      manageOthersSchedule: "Horaires des autres",
      manageOwnTimeOff: "Ses propres congés",
      manageOthersTimeOff: "Congés des autres",
    },
  },
  forms: { label: "Formulaires", actions: { manage: "Modifier les formulaires" } },
  customization: { label: "Page de réservation", actions: { manage: "Modifier l'apparence" } },
  settings: { label: "Réglages", actions: { manage: "Modifier les réglages" } },
  team: { label: "Équipe", actions: { view: "Voir l'équipe", manage: "Inviter et gérer" } },
  grades: { label: "Grades", actions: { view: "Voir", manage: "Créer et modifier" } },
  logs: { label: "Journal", actions: { view: "Voir le journal d'activité" } },
  billing: { label: "Abonnement", actions: { manage: "Gérer l'abonnement et les modules" } },
  business: { label: "Établissement", actions: { manage: "Modifier les infos", delete: "Supprimer l'établissement" } },
} as const;

type Catalog = typeof PERMISSIONS;
export type PermissionDomain = keyof Catalog;
export type PermissionAction<D extends PermissionDomain> = keyof Catalog[D]["actions"];

/** Permissions stockées sur un grade : `{ appointments: { view: true, … }, … }`. */
export type Permissions = { [D in PermissionDomain]: { [A in PermissionAction<D>]: boolean } };

/** Une permission sous forme de chaîne : "appointments.manage". */
export type PermissionKey = { [D in PermissionDomain]: `${D}.${PermissionAction<D> & string}` }[PermissionDomain];

function build(value: boolean): Permissions {
  const out = {} as Record<string, Record<string, boolean>>;
  for (const [domain, def] of Object.entries(PERMISSIONS)) {
    out[domain] = Object.fromEntries(Object.keys(def.actions).map((a) => [a, value]));
  }
  return out as Permissions;
}

export const NO_PERMISSIONS: Permissions = build(false);
export const ALL_PERMISSIONS: Permissions = build(true);

/** Grades créés automatiquement avec chaque établissement. */
export const BUILT_IN_GRADES: { name: string; permissions: Permissions }[] = [
  { name: "Administrateur", permissions: ALL_PERMISSIONS },
  {
    name: "Collaborateur",
    permissions: {
      ...NO_PERMISSIONS,
      appointments: { view: true, manage: true, cancel: false },
      customers: { view: true, manage: true },
      services: { view: true, manage: false },
      groupSessions: { view: true, manage: false },
      availability: { manageShared: false, manageOwnSchedule: true, manageOthersSchedule: false, manageOwnTimeOff: true, manageOthersTimeOff: false },
      team: { view: true, manage: false },
    },
  },
];

export function can(perms: Permissions | null | undefined, key: PermissionKey, isOwner = false): boolean {
  if (isOwner) return true;
  if (!perms) return false;
  const [domain, action] = key.split(".") as [PermissionDomain, string];
  const group = perms[domain] as Record<string, boolean> | undefined;
  return group?.[action] === true;
}
