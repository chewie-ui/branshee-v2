/**
 * Version de test (sous-domaine) : `STAGING=1` dans l'environnement.
 * Rien ne doit atteindre les vrais patients ni les vrais agendas depuis cette version :
 * emails détournés vers `STAGING_EMAIL_TO` (ou seulement journalisés), SMS / WhatsApp / notifications push
 * coupés, pas de synchronisation Google Agenda, pas d'indexation par les moteurs de recherche.
 */
export const isStaging = () => process.env.STAGING === "1";
