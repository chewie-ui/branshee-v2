/** Logique pure du questionnaire d'orientation, partagée entre le serveur et le tunnel de réservation. */

export type IntakeQuestion = { id: string; question: string; options: { id: string; label: string; serviceIds: string[] }[] };

/**
 * Une prestation est proposée si, pour chaque question où elle est liée à au moins une réponse,
 * la réponse donnée fait partie de celles-là. Une question sans lien avec elle ne la filtre pas.
 */
export function serviceMatches(serviceId: string, questions: IntakeQuestion[], answers: Record<string, string>) {
  return questions.every((q) => {
    const linked = q.options.filter((o) => o.serviceIds.includes(serviceId));
    if (linked.length === 0) return true;
    const answer = answers[q.id];
    return answer !== undefined && linked.some((o) => o.id === answer);
  });
}

/** Une question ne vaut la peine d'être posée que si sa réponse change les prestations proposées. */
export function questionMatters(question: IntakeQuestion, serviceIds: string[]) {
  return serviceIds.some((id) => question.options.some((o) => o.serviceIds.includes(id)));
}
