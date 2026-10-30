/**
 * zod avec des messages d'erreur en français compréhensibles par un pro (« Indiquez un nombre valide. »)
 * au lieu des messages techniques anglais. Importer `z` d'ici, jamais de "zod" directement.
 */
import { z } from "zod";
import fr from "zod/v4/locales/fr.js";

const nb = (n: unknown) => String(n).replace(".", ",");

z.config(fr());
z.config({
  customError: (iss) => {
    switch (iss.code) {
      case "invalid_type":
        if (iss.expected === "number" || iss.expected === "int") return "Indiquez un nombre valide.";
        if (iss.expected === "date") return "Indiquez une date valide.";
        if (iss.input === undefined || iss.input === null || iss.input === "") return "Ce champ est obligatoire.";
        return "Valeur invalide.";
      case "too_small":
        if (iss.origin === "number") return Number(iss.minimum) === 0 ? "Le nombre ne peut pas être négatif." : `Le nombre doit être d'au moins ${nb(iss.minimum)}.`;
        if (iss.origin === "string") return Number(iss.minimum) <= 1 ? "Ce champ est obligatoire." : `Au moins ${iss.minimum} caractères.`;
        if (iss.origin === "array" || iss.origin === "set") return "Choisissez au moins un élément.";
        return undefined;
      case "too_big":
        if (iss.origin === "number") return `Le nombre ne peut pas dépasser ${nb(iss.maximum)}.`;
        if (iss.origin === "string") return `${iss.maximum} caractères maximum.`;
        if (iss.origin === "array" || iss.origin === "set") return `${iss.maximum} éléments maximum.`;
        return undefined;
      case "invalid_format":
        return iss.format === "email" ? "Adresse e-mail invalide." : iss.format === "url" ? "Adresse web invalide." : "Format invalide.";
      case "invalid_value":
        return "Choix invalide.";
      default:
        return undefined;
    }
  },
});

export { z };
