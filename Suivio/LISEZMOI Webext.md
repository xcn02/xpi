# Suivio 2.0 — version WebExtension (Thunderbird 115+)

Réécriture complète de l'extension **en WebExtension standard** (MV2),
sans code XUL/XPCOM/Experiments — installable sans redémarrage, et
compatible avec les Thunderbird récents (115 et suivants ; à tester sur
votre version exacte).

## Changement de fond par rapport à la version legacy

Il n'existe **pas d'API WebExtension stable** pour ajouter une colonne
personnalisée à la liste des messages (le support existe côté
Thunderbird depuis la 115, mais uniquement via des "Experiments" — du
code privilégié non soumettable tel quel sur addons.thunderbird.net,
et l'API publique définitive n'a toujours pas été figée à ce jour).

**Suivio utilise donc les tags natifs de Thunderbird** comme mécanisme
d'état :
- `Suivio : à traiter` (rouge)
- `Suivio : en attente` (orange)
- `Suivio : rappel` (bleu)
- `Suivio : fait` (vert)

Ces tags sont créés automatiquement au premier lancement. Avantages :
visibles nativement dans la colonne "Étiquette", **filtrables et
triables** sans rien coder de plus, et surtout **utilisables
directement dans la barre de filtre rapide** — ce qui n'était pas
possible dans la version legacy.

## Fonctionnalités

- Menu contextuel (clic droit sur un message, liste des messages) :
  mêmes choix que la version legacy (à traiter / en attente / rappel
  avec raccourcis rapides / fait / effacer / voir tous les rappels).
- Fenêtre de rappel avec **sélecteurs natifs date/heure du navigateur**
  (`<input type="date">` / `<input type="time">`) — plus besoin de
  mini-calendrier fait main.
- Notifications système **avec vrais boutons intégrés** ("Reporter +1
  jour" / "Marquer comme fait") — l'API `notifications` moderne le
  permet nativement, contrairement à l'ancienne `nsIAlertsService`.
- Fenêtre récapitulative (page HTML), mise en avant automatiquement à
  l'échéance d'un rappel, ligne surlignée.
- Page de paramètres (Modules complémentaires → Suivio → Options).
- Stockage par **Message-ID** via `storage.local` (persiste après
  déplacement de message et redémarrage, comme en legacy).

## Installation

1. Modules complémentaires → ⚙ → **Installer un module depuis un
   fichier...** → sélectionner le `.xpi`.
2. Aucun redémarrage nécessaire (WebExtension standard).

## Points à vérifier en conditions réelles

Certaines API Thunderbird sont récentes ou évoluent encore ; à tester
et ajuster si besoin :
- **Permissions du manifeste** (`messagesTags`, `messagesUpdate`) : les
  noms exacts de permissions ont un peu bougé selon les versions de
  Thunderbird. Si l'extension refuse de s'installer ou qu'une action
  échoue silencieusement, regarder la Console des erreurs
  (Outils → Console des erreurs) — le message indiquera la permission
  manquante à ajouter dans `manifest.json`.
- **`browser.messages.tags.create(key, label, color)`** : signature
  vérifiée sur la documentation disponible au moment de l'écriture ;
  si votre version de Thunderbird a un ordre de paramètres différent,
  l'erreur apparaîtra dans la console au premier lancement.
- **`browser.messageDisplay.open()`** (bouton "Ouvrir" du récap) : API
  encore jeune, le comportement exact (nouvel onglet vs fenêtre) peut
  varier selon la version.
- **Alarme `periodInMinutes: 1`** : certaines versions imposent un
  minimum d'1 minute pour les alarmes ; si ce n'est pas le cas sur la
  vôtre, la vérification des rappels sera simplement un peu moins
  réactive, sans casser le fonctionnement.

## Ce qui change par rapport à la version legacy (Thunderbird 60)

| | Legacy (60.9.1) | WebExtension (115+) |
|---|---|---|
| État visuel | Colonne dédiée avec icônes | Tags natifs (colonne Étiquette) |
| Clic pour changer l'état | Petit menu sur la cellule | Menu contextuel clic-droit |
| Filtre rapide par état | Non réalisable | Natif, gratuit (via les tags) |
| Sélection date/heure | Mini-calendrier fait main | `<input type="date/time">` natif |
| Notification avec action | Snooze via fenêtre séparée | Boutons intégrés à la notification |
| Redémarrage à l'installation | Obligatoire | Non nécessaire |
| Soumission addons.thunderbird.net | Non (legacy non accepté) | Oui, en théorie (à valider) |

## Structure du projet

```
suivio-webext/
├── manifest.json
├── common.js          # Constantes des tags, stockage, recherche par Message-ID
├── background.js      # Menus, alarme de vérification, notifications
├── rappel.html/.js    # Fenêtre "Définir un rappel"
├── recap.html/.js     # Fenêtre récapitulative
├── options.html/.js   # Page de paramètres
└── icons/
```
