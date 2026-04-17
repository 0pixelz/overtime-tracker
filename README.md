# Heures supplémentaires

Application web (PWA) de suivi des heures de travail et heures supplémentaires. Aucun compte, aucun serveur, aucune donnée envoyée ailleurs — tout reste sur ton appareil.

## Fonctionnalités

### Saisie rapide
- **Heure de début / fin** avec sélecteurs de temps natifs
- **Durée du repas** : aucun, 30 ou 60 minutes
- **Valeurs par défaut** configurables (8 h → 16 h 30, 60 min par défaut)
- **Note** libre pour détailler la journée
- **Sauvegarde automatique** à chaque modification (point vert de confirmation)
- **Remplissage rapide** d'une journée vide avec tes valeurs par défaut (bouton ⚡)
- **Dupliquer** une journée précédente vers le jour courant
- **Effacer** une journée avec double-clic de confirmation
- **Long-press** sur un jour vide dans la liste hebdo → navigue + remplit d'un coup (avec vibration tactile)

### Congés
Quatre types de congé avec calcul automatique :
- Congé personnel
- Journée anniversaire
- Journée vacances
- Congé fin de semaine (samedi/dimanche par défaut, ne compte pas dans les 37,5 h)

Les jours de congé (sauf fin de semaine) comptent pour 7,5 h dans le total hebdomadaire.

### Suivi hebdomadaire
- **Barre de progression fine** en haut de l'écran qui se remplit vers l'objectif (style loader)
- **Carte progression** avec total, pourcentage et heures restantes ou heures supplémentaires
- **Calendrier mensuel** avec indicateurs colorés (travail, congé, heures sup.)
- **Liste « Ma semaine »** cliquable avec total et heures sup. par jour
- Navigation jour par jour, mois par mois, ou via le calendrier

### Paramètres
- **6 thèmes** : Nuit ambrée, Clair ambré, Rouge, Forêt, Océan, Cassis
- **Horaires par défaut** entièrement configurables
- **Langue** : Français (Canada) ou English
- **Type de semaine** : Lundi–vendredi (5 jours) ou Dimanche–samedi (7 jours)

### Exports
Quatre destinations possibles, chacune pour la période choisie (semaine / mois / tout) :
- **Courriel** — ouvre ton application courriel avec un résumé formaté
- **Partage (OneNote, Drive, etc.)** — via le menu de partage Android
- **Fichier CSV** — ouvrable dans Excel / Sheets / Numbers
- **Rapport PDF** — mise en page propre avec tableau, totaux et date de génération, prêt à imprimer

### Installation sur téléphone (PWA)
- Installable sur Android comme une vraie application
- Fonctionne hors-ligne une fois installée
- Icône sur l'écran d'accueil, sans barre d'adresse

## Vie privée

**Toutes tes données restent sur ton appareil.** Elles ne sont ni envoyées, ni partagées, ni sauvegardées ailleurs. Pas de compte, pas de serveur, pas d'analytics.

Les données sont stockées dans le `localStorage` du navigateur. Si tu vides les données du site, désinstalles l'app, ou changes de téléphone, tu perdras ton historique. **Pense à exporter un PDF ou un CSV de temps en temps comme sauvegarde.**

## Déploiement sur GitHub Pages

1. **Créer un dépôt GitHub**
   - Crée un nouveau dépôt public (par exemple `heures-sup`)

2. **Téléverser les fichiers**
   Place tous les fichiers à la racine du dépôt :
   ```
   index.html
   manifest.json
   service-worker.js
   icon-192.png
   icon-512.png
   icon-maskable-512.png
   README.md
   ```

3. **Activer GitHub Pages**
   - Dépôt → Settings → Pages
   - Source : `Deploy from a branch`
   - Branch : `main` (ou `master`) / `/ (root)`
   - Save

4. **Accéder à l'app**
   - URL : `https://<ton-utilisateur>.github.io/<nom-du-depot>/`
   - Attends 1-2 minutes après la première activation

## Installation sur Android

1. Ouvre l'URL dans **Chrome** sur ton téléphone
2. Un bouton « Installer » apparaîtra dans l'application
3. Sinon : menu Chrome (⋮) → « Installer l'application » ou « Ajouter à l'écran d'accueil »
4. L'app s'ouvrira comme une application native, sans barre d'adresse

## Détails techniques

- **Standards** : une journée standard = 7,5 h, une semaine standard = 37,5 h
- **Calcul des heures sup.** : tout dépassement au-delà de 7,5 h par jour ou 37,5 h par semaine
- **Stockage** : `localStorage` du navigateur
- **Hors-ligne** : service worker avec cache network-first pour le HTML et cache-first pour les autres ressources
- **Aucune dépendance externe** à l'exécution (sauf Google Fonts pour la typographie)
- **PDF généré côté client** sans bibliothèque, fonctionne hors-ligne
- **Dark et light mode** avec 6 variations de thème, tous configurables en un clic
