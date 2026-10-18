# Branshee — application de bureau

Fenêtre native (Electron) autour de l'espace pro de Branshee : toutes les fonctions du site,
la session gardée entre deux lancements, les liens externes ouverts dans le navigateur.

## Lancer

```bash
cd desktop
npm install
npm start                 # pointe sur https://branshee.com
npm run dev               # pointe sur http://localhost:3000 (site lancé en local)
BRANSHEE_URL=https://staging.example.com npm start
```

## Construire les installateurs

```bash
npm run dist:win          # .exe (NSIS) — à lancer sous Windows
npm run dist:mac          # .dmg — à lancer sous macOS (signature Apple à configurer)
npm run dist:linux        # AppImage
```

Les fichiers sont créés dans `desktop/dist/`.
