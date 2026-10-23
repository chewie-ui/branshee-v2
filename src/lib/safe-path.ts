/**
 * Chemin interne sûr pour une redirection (« suite », « next ») : commence par un seul « / », sans « \ »,
 * sans caractère de contrôle ni espace (les navigateurs transforment « /\evil.com » en « //evil.com »).
 */
export function safeInternalPath(value?: string | null): string | undefined {
  if (!value || !/^\/(?![/\\])[\w\-/?=&%.~:+,@]*$/.test(value)) return undefined;
  return value;
}
