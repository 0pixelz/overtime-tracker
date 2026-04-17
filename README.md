# Mes Heures

Suivi des heures de travail — 7h30/jour, 37h30/semaine. Application web installable (PWA) qui fonctionne hors ligne. Données stockées localement dans le navigateur.

## Structure des fichiers

```
heures/
├── index.html          # Markup + contenu
├── styles.css          # Tous les styles
├── app.js              # Logique de l'application
├── manifest.json       # Métadonnées PWA (nom, icônes, couleurs)
├── sw.js               # Service Worker (offline)
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable.png
└── README.md
```

## Déployer sur GitHub Pages (gratuit)

1. **Créer un repo** sur github.com — nomme-le par exemple `heures`.

2. **Pousser les fichiers** depuis ton dossier local :

   ```bash
   cd heures
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/TON-USER/heures.git
   git push -u origin main
   ```

3. **Activer Pages** : Repo → *Settings* → *Pages* → *Source: Deploy from a branch* → *Branch: main* → */ (root)* → *Save*.

4. Attends ~1 min. L'app sera accessible à :
   `https://TON-USER.github.io/heures/`

5. **Installer sur le téléphone** : ouvre le lien dans Safari (iOS) ou Chrome (Android), puis "Ajouter à l'écran d'accueil" / "Installer l'application". L'icône apparaît comme une vraie app, en plein écran, fonctionne hors ligne.

## Modifier l'app

- **Changer un style** → `styles.css`
- **Changer la logique** (calculs, sauvegarde, etc.) → `app.js`
- **Ajouter un élément** → `index.html`

Après chaque modification poussée sur GitHub, **incrémenter `CACHE_VERSION`** dans `sw.js` (ex. `v1` → `v2`). Sinon le Service Worker servira l'ancienne version en cache aux utilisateurs déjà installés.

```js
// sw.js
const CACHE_VERSION = 'v2';  // bump this
```

## Données

Tout est stocké dans `localStorage` sous deux clés :
- `mh_settings` — tes paramètres (heures/jour, heures par défaut, etc.)
- `mh_data` — les jours saisis `{ 'YYYY-MM-DD': { start, end, lunch, dayOff } }`

Pas de compte, pas de serveur, pas de tracking. Si tu changes de navigateur ou effaces les données du site, tout disparaît.

### Export / import (optionnel)

Pour sauvegarder manuellement tes données, dans la console du navigateur :

```js
// Export
copy(localStorage.getItem('mh_data'))
```

```js
// Import (colle ta sauvegarde)
localStorage.setItem('mh_data', '...ton_json...')
```

## Personnaliser

- **Couleur principale** : `--accent: #7c2d2d` dans `styles.css` + `theme_color` dans `manifest.json` + `<meta name="theme-color">` dans `index.html`.
- **Objectif par défaut** : modifier `DEFAULTS` dans `app.js` (heures/jour, jours/semaine, heures d'arrivée/départ, lunch).
- **Langue** : le texte est en français. Pour traduire, remplacer les chaînes dans `index.html` et dans les `DAYS_FR` / `DAYS_SHORT` de `app.js`.

## Licence

Usage personnel. Fais-en ce que tu veux.
