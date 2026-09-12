# ICS Import CLH — Thunderbird / Lightning

Extension **legacy (bootstrap.js)** pour Thunderbird qui intercepte un fichier `.ics` passé en ligne de commande (typiquement via un double-clic Windows), le répare si besoin, le fait parser par le service ICS natif de Lightning, puis ouvre la fenêtre d'édition d'événement pré-remplie pour validation manuelle — sans ouvrir de message ni de pièce jointe.

> ⚠️ **Statut : non maintenue / obsolète.** Compatible uniquement avec **Thunderbird 60**. Ne fonctionne pas sur les versions récentes de Thunderbird (voir [Compatibilité](#compatibilité)).

## Pourquoi cette extension

Thunderbird/Lightning n'a jamais géré nativement l'ouverture directe d'un fichier `.ics` par double-clic depuis le système de fichiers : dans le meilleur des cas rien ne se passe, dans le pire il est traité comme une pièce jointe. C'est un comportement documenté depuis longtemps côté Mozilla et toujours pas résolu — l'import se fait aujourd'hui via `Événements et tâches → Importer`, ou par glisser-déposer.

Cette extension automatisait ce contournement : elle interceptait l'argument `.ics` sur la ligne de commande, avant que Thunderbird ne l'interprète comme une pièce jointe à joindre à un nouveau message.

## Fonctionnement

1. **Interception ligne de commande** — enregistre un handler `nsICommandLineHandler` (préfixe `0-`, donc prioritaire sur le handler mail natif) qui détecte tout argument `.ics`, le retire de la ligne de commande et empêche l'ouverture d'un message avec pièce jointe.
2. **Réparation ICS** — corrige automatiquement un cas connu de fichier malformé (`DTSTART;VALUE=DATE:` combiné à une heure), source fréquente de l'erreur Thunderbird `2147500037`.
3. **Attente de disponibilité des calendriers** — patiente jusqu'à l'événement `calendar-startup-done` (avec filet de sécurité de 6 s) avant d'importer, pour ne pas rater les calendriers CalDAV au démarrage à froid.
4. **Import via le service natif** — parsing du fichier via `@mozilla.org/calendar/import;1?type=ics`.
5. **Choix du calendrier cible** — calendrier par défaut → calendrier sélectionné dans la fenêtre courante → seul calendrier disponible → sélection manuelle si ambiguïté.
6. **Validation humaine obligatoire** — n'enregistre jamais l'événement directement : ouvre la fenêtre d'édition standard de Lightning, pré-remplie, pour relecture et confirmation manuelle par l'utilisateur.

## Installation

1. Télécharger `ics-import-clh.xpi`.
2. Dans Thunderbird : `Modules complémentaires et thèmes` → icône engrenage → `Installer un module depuis un fichier...` → sélectionner le `.xpi`.
3. Associer l'extension `.ics` à Thunderbird au niveau du système d'exploitation (Windows : `Ouvrir avec` → Thunderbird → toujours utiliser cette application).

## Compatibilité

| Thunderbird | Compatible |
|---|---|
| 60.x | ✅ (cible d'origine) |
| ≥ 68 | ❌ |
| Versions récentes (ESR 128, 140+...) | ❌ |

Raisons de l'incompatibilité :

- `install.rdf` fixe explicitement `maxVersion = 60.*`.
- Architecture **legacy bootstrap** (XPCOM, `install.rdf`) abandonnée au profit des **WebExtensions** (`manifest.json`) depuis Thunderbird 68/78.
- APIs utilisées disparues ou remplacées : `Cu.import` sur `.jsm`, enregistrement de composant XPCOM custom via `nsIComponentRegistrar`, `chrome://messenger/content/messenger.xul` (remplacé par `.xhtml`).
- APIs internes Lightning (`calICalendarManager`, `calIImporter`, `createEventWithDialog`) largement réécrites depuis TB 60.

**Une réécriture en WebExtension serait nécessaire** pour un support moderne, avec deux points durs à valider :
- l'étendue de l'accès aux calendriers CalDAV/ICS via l'API `messenger.*` des WebExtensions ;
- l'absence d'équivalent WebExtension direct à `nsICommandLineHandler` pour l'interception de ligne de commande (probablement à traiter côté association de fichiers OS).

## Licence

MIT — voir [LICENSE](LICENSE).
