// ── Branshee — application de bureau ─────────────────────────────────────
// Une fenêtre native autour de l'espace pro de Branshee : toutes les fonctions
// du site sont disponibles, sans code à maintenir en double. La session est
// gardée entre deux lancements (cookie httpOnly du site, stockage persistant).
//
// Sécurité :
//   • aucune API Node n'est exposée à la page (contextIsolation, sandbox) ;
//   • la fenêtre ne navigue que sur le domaine Branshee — tout autre lien
//     (Google Maps, Stripe, site d'un client…) s'ouvre dans le navigateur ;
//   • aucune autorisation (caméra, micro, position…) n'est accordée.
const { app, BrowserWindow, Menu, shell, session, nativeTheme } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const APP_URL = (process.env.BRANSHEE_URL || "https://branshee.com").replace(/\/$/, "");
const ORIGIN = new URL(APP_URL).origin;
// Le site peut être servi avec ou sans « www » : les deux restent dans la fenêtre.
const sameSite = (url) => {
  try {
    const u = new URL(url);
    const base = new URL(APP_URL);
    return u.protocol === base.protocol && u.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
};
// Paiements et connexion Google : pages externes, mais qui doivent revenir dans la fenêtre.
const IN_WINDOW = [/^https:\/\/accounts\.google\.com\//, /^https:\/\/checkout\.stripe\.com\//, /^https:\/\/billing\.stripe\.com\//, /^https:\/\/connect\.stripe\.com\//];

let win = null;
const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return { width: 1280, height: 820 };
  }
}

function saveState() {
  if (!win || win.isDestroyed()) return;
  const b = win.getNormalBounds();
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {
    /* préférence non critique */
  }
}

function createWindow() {
  const s = readState();
  win = new BrowserWindow({
    x: s.x,
    y: s.y,
    width: s.width || 1280,
    height: s.height || 820,
    minWidth: 900,
    minHeight: 600,
    title: "Branshee",
    icon: path.join(__dirname, "assets", "icon.png"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#111113" : "#f7f7f8",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      partition: "persist:branshee",
    },
  });
  if (s.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());
  win.on("close", saveState);

  const wc = win.webContents;
  // Nouvelle fenêtre (target=_blank) : le site reste dans l'application, le reste part dans le navigateur.
  wc.setWindowOpenHandler(({ url }) => {
    if (sameSite(url)) {
      wc.loadURL(url);
      return { action: "deny" };
    }
    if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (event, url) => {
    if (sameSite(url) || IN_WINDOW.some((re) => re.test(url))) return;
    event.preventDefault();
    if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url);
  });
  // Sans connexion : page locale avec un bouton « Réessayer ».
  wc.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = navigation annulée
    win.loadFile(path.join(__dirname, "offline.html"), { query: { retry: url || `${APP_URL}/app` } });
  });

  win.loadURL(`${APP_URL}/app`);
}

// Une seule instance : relancer l'application remet la fenêtre existante au premier plan.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("com.branshee.desktop");
    const ses = session.fromPartition("persist:branshee");
    ses.setPermissionRequestHandler((_wc, permission, done) => done(permission === "clipboard-sanitized-write" || permission === "notifications"));
    ses.setSpellCheckerLanguages(["fr", "en-GB"]);

    // Menu minimal (raccourcis copier/coller, zoom, recharger) sans barre visible sous Windows/Linux.
    const template = [
      ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
      { label: "Édition", submenu: [{ role: "undo", label: "Annuler" }, { role: "redo", label: "Rétablir" }, { type: "separator" }, { role: "cut", label: "Couper" }, { role: "copy", label: "Copier" }, { role: "paste", label: "Coller" }, { role: "selectAll", label: "Tout sélectionner" }] },
      { label: "Affichage", submenu: [{ role: "reload", label: "Recharger" }, { type: "separator" }, { role: "resetZoom", label: "Taille réelle" }, { role: "zoomIn", label: "Zoom avant" }, { role: "zoomOut", label: "Zoom arrière" }, { type: "separator" }, { role: "togglefullscreen", label: "Plein écran" }] },
      { label: "Aide", submenu: [{ label: "Centre d'aide", click: () => win?.loadURL(`${APP_URL}/app/aide`) }, { label: "Ouvrir dans le navigateur", click: () => shell.openExternal(win?.webContents.getURL().startsWith(ORIGIN) ? win.webContents.getURL() : `${APP_URL}/app`) }] },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));

    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // Toute fenêtre ou vue créée hors de ce fichier est refusée (défense en profondeur).
  app.on("web-contents-created", (_e, contents) => {
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });
}
