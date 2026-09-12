# Suivio

Suivio est une extension **legacy (overlay XUL / XPCOM)** pour
**Mozilla Thunderbird 60.9.1 (32 bits)**, qui ajoute un système de
suivi des e-mails inspiré du "Follow Up / Flag" d'Outlook, directement
intégré à la liste des messages.

> ⚠️ Ciblage strict : `install.rdf` fixe `minVersion=60.0` /
> `maxVersion=60.*`. Ce n'est pas une WebExtension moderne — Thunderbird
> a retiré le support des extensions legacy dans les versions
> ultérieures.

## Fonctionnalités

- **Colonne "Suivi"** dans le thread pane, avec une icône selon l'état :
  aucun · 🚩 à traiter (rouge) · 🚩 en attente (orange) · 🕐 rappel
  programmé (bleu) · ✓ fait (vert).
- **Menu contextuel** (clic droit sur un message) `Suivi / Follow-up`,
  positionné juste sous "Marquer".
- **Petit menu de choix rapide** au clic gauche sur la cellule de la
  colonne (à traiter / en attente / rappel / fait / effacer).
- **Rappels** : date/heure avec mini-calendrier et sélecteurs
  heure/minute éditables, raccourcis rapides (Demain / 3 jours /
  1 semaine), notification système cliquable avec **snooze**
  (+1h / demain / +1 semaine / marquer comme fait).
- **Rattrapage groupé** : un seul toast récapitulatif si plusieurs
  rappels tombent en même temps (au lieu d'un par un).
- **Fenêtre récapitulative** (`Outils → Rappels de Suivio…`), façon
  Mailmindr : colonnes État / Sujet / Expéditeur / Échéance, avec
  Modifier / Ouvrir / Supprimer. S'ouvre aussi automatiquement,
  ligne surlignée, quand un rappel arrive à échéance.
- **Paramètres** (`Outils → Paramètres de Suivio…`) : surlignage des
  lignes selon l'état, regroupement des notifications.
- **Raccourcis clavier** (focus sur la liste des messages) :
  `Alt+1` à traiter, `Alt+2` en attente, `Alt+3` fait, `Alt+0` effacer.
- Interface entièrement en français.

## Installation

1. Thunderbird → ☰ → **Modules complémentaires**.
2. ⚙ → **Installer un module depuis un fichier...** → sélectionner le
   `.xpi`.
3. **Redémarrer Thunderbird** (extension non-restartless, redémarrage
   obligatoire après installation/suppression).

## Stockage des données

Le suivi est indexé par **Message-ID** dans un fichier JSON du profil
(`suivi-data.json`), et non par en-tête `X-Mail-FollowUp` ni propriété
custom `nsIMsgDBHdr` — ces dernières ne survivent pas de façon fiable à
un déplacement du message vers un autre dossier. Le Message-ID reste
stable quel que soit le dossier, ce qui garantit la persistance après
déplacement et redémarrage.

## Structure du projet

```
suivio/
├── install.rdf                  # Manifeste (cible TB 60.x)
├── chrome.manifest               # Déclarations content/skin/locale/overlay
├── defaults/preferences/         # Préférences par défaut
├── chrome/
│   ├── content/
│   │   ├── suivi.js               # Logique principale (stockage, colonne, rappels)
│   │   ├── columnOverlay.xul       # Overlay → messenger.xul (colonne, menu Outils, clic cellule)
│   │   ├── contextMenuOverlay.xul  # Overlay → mailWindowOverlay.xul (menu clic-droit)
│   │   ├── rappelDialog.xul/.js    # Fenêtre "Définir un rappel"
│   │   ├── rappelsListWindow.xul/.js # Fenêtre récapitulative
│   │   ├── snoozeDialog.xul/.js     # Mini-fenêtre de snooze (clic sur notification)
│   │   └── optionsDialog.xul/.js    # Fenêtre de paramètres
│   ├── skin/                     # CSS + icônes (générées, PNG 16×16)
│   └── locale/fr/                # Chaînes françaises (.dtd)
└── LISEZMOI.md                   # Notes d'installation, choix techniques, limites connues
```

## Limites connues

Ce sont des API internes non-WebExtension peu documentées pour cette
version précise de Thunderbird (colonnes personnalisées de thread pane,
overlays de menu contextuel, notifications système cliquables...). Les
choix techniques et points de vigilance en conditions réelles sont
détaillés dans [`LISEZMOI.md`](./LISEZMOI.md).

Non implémenté : bouton dans la barre de filtre rapide (`quickFilterBar.js`),
et intégration directe avec Mailmindr (aucune API publique identifiée —
Suivio fonctionne en totale autonomie).

## Licence

À définir par le mainteneur du dépôt.
