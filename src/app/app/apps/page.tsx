import { redirect } from "next/navigation";

/** Ancienne page « Toutes les apps » : le catalogue est maintenant sur l'accueil (/app). */
export default function Page() {
  redirect("/app");
}
