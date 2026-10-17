import { startTransition, type FormEvent } from "react";

/**
 * React réinitialise un <form action={…}> après chaque envoi : en cas d'erreur de validation,
 * l'utilisateur perdrait tout ce qu'il a saisi. On soumet donc manuellement, sans réinitialisation.
 */
export function submitKeepingValues(action: (fd: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(() => action(fd));
  };
}
