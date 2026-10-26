import { redirect } from "next/navigation";

/** L'ancienne page « Modules » est remplacée par le lanceur d'apps. */
export default function Page() {
  redirect("/app/apps");
}
