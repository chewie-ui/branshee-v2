/* Service worker minimal : rend l'application installable et affiche une page hors ligne. Aucune donnée mise en cache. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(
      () => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Hors ligne</title><body style="font-family:system-ui;padding:40px;text-align:center"><h1>Pas de connexion</h1><p>Branshee a besoin d\'internet. Réessayez dès que vous êtes reconnecté.</p></body>', { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
