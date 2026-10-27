import { redirect } from "next/navigation";

/** Ancienne page « Congés (bientôt) » de l'app Employés : les congés ont maintenant leur app. */
export default function Page() {
  redirect("/app/conges");
}
