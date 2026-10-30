import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Concatène des classes Tailwind en résolvant les conflits. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** « de » ou « d' » devant un nom : « d'Atelier FM », « d'octobre », « de Salon Marc ». */
export function de(word: string) {
  return /^[aeiouyhàâäéèêëîïôöûüÿœ]/i.test(word.trim()) && !/^(h[aeiouy]a?ut|hu[iî]t)/i.test(word.trim()) ? `d'${word}` : `de ${word}`;
}
