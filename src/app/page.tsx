import { redirect } from "next/navigation";

// La page d'accueil publique (marketing) viendra plus tard ; pour l'instant on ouvre l'espace pro.
export default function Home() {
  redirect("/app");
}
