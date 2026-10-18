// Le site n'a besoin d'aucune fonction native : rien n'est exposé à la page,
// sauf l'information « on tourne dans l'application de bureau » (pour masquer
// par exemple le bouton « Installer l'application »).
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("bransheeDesktop", { isDesktop: true, platform: process.platform });
