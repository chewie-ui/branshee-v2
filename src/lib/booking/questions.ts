/** Une question du formulaire s'applique à une prestation si elle vise toutes les prestations (liste vide) ou celle-ci. */
export function questionApplies(q: { serviceIds?: string[] | null }, serviceIds: string | string[]): boolean {
  if (!q.serviceIds?.length) return true;
  const ids = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
  return ids.some((id) => q.serviceIds!.includes(id));
}
