-- Apps en option de l'offre Skydev (facturées en ligne d'abonnement, voir business_modules).
INSERT INTO "modules" ("key", "name", "description", "price_cents", "position")
VALUES ('tel_ia', 'Tél IA', 'Une IA répond à vos appels manqués et vous envoie le résumé.', 3900, 1)
ON CONFLICT ("key") DO NOTHING;
