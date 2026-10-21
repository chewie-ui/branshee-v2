/**
 * Adresse du webhook Stripe de l'ancien Branshee (https://www.branshee.com/account/webhook) :
 * même traitement que /api/stripe/webhook, pour que l'endpoint déjà déclaré chez Stripe continue de fonctionner après la bascule.
 */
export { POST } from "@/app/api/stripe/webhook/route";
