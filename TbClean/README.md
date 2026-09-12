# TB Clean Menu

Extension légère pour **Thunderbird 60** (et versions ESR compatibles ≤ 60.*) qui permet de masquer les entrées inutiles du menu contextuel (clic droit) sur les messages.

![screenshot](screenshot.png)

## Pourquoi

Le clic droit sur un message dans Thunderbird affiche par défaut une vingtaine d'entrées, dont beaucoup ne servent jamais. Cette extension permet de choisir précisément lesquelles garder, via une fenêtre de configuration à cases à cocher.

## Fonctionnalités

- Masque dynamiquement les entrées choisies, sans toucher aux fichiers de Thunderbird
- Fenêtre de configuration accessible depuis **Outils → Nettoyer le clic droit...**
- Prise en compte immédiate (pas besoin de redémarrer Thunderbird après un changement)
- Double détection (ID interne + libellé en secours) pour rester robuste si les ID changent selon les versions/langues

## Installation

1. Télécharger le fichier [`tbcleanmenu.xpi`](tbcleanmenu.xpi)
2. Dans Thunderbird : menu ☰ → **Modules complémentaires** → roue crantée → **Installer un module depuis un fichier**
3. Sélectionner le `.xpi`
4. Redémarrer Thunderbird

## Utilisation

**Outils → Nettoyer le clic droit...** → cocher les entrées à masquer → **Enregistrer**.

## Limites

- Compatible uniquement avec les Thunderbird basés sur les overlays XUL legacy (≤ 60.x). Ne fonctionnera pas sur les versions récentes (WebExtensions only).
- Si une entrée ne se masque pas correctement, c'est probablement que son ID interne diffère de celui prévu dans `overlay.js` — ouvrir une issue avec le nom exact de l'entrée concernée.
- Désactiver l'extension réaffiche immédiatement toutes les entrées (comportement volontaire : rien n'est modifié en dur).

## Licence

Libre d'usage et de modification, sans garantie.
