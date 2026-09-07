# 🔑 Générateur de mots de passe — extension Firefox

Extension Firefox légère (Manifest V3) pour générer et insérer des mots de passe directement dans les champs de formulaire, sans dépendance externe.

## Fonctionnalités

- **Clic gauche sur l'icône** : génère un mot de passe avec les réglages enregistrés et l'insère directement dans le dernier champ mot de passe détecté (+ remplit automatiquement un éventuel champ de confirmation).
- **Clic droit sur l'icône** : menu rapide — copier le dernier mot de passe généré, changer de mode (aléatoire / lisible / passphrase), activer/désactiver majuscules, chiffres, symboles, ouvrir les réglages complets.
- **Clic droit sur un champ mot de passe** : "Générer un mot de passe ici", directement depuis le menu contextuel natif.
- **3 modes de génération** :
  - `random` : aléatoire pur (lettres/chiffres/symboles, option d'exclusion des caractères ambigus `i l 1 L o O 0`)
  - `readable` : plus facile à retenir/saisir
  - `passphrase` : suite de mots séparés par un caractère, à la façon [xkcd 936](https://xkcd.com/936/)
- **Génération cryptographiquement sûre** : utilise `crypto.getRandomValues`, jamais `Math.random`.
- Réglages persistés via `browser.storage.local`, page d'options dédiée.

## Installation (développement)

1. Cloner ce dépôt.
2. Dans Firefox, aller sur `about:debugging#/runtime/this-firefox`.
3. Cliquer sur **Charger un module complémentaire temporaire**.
4. Sélectionner le fichier `manifest.json` du dossier cloné.

L'extension reste chargée tant que Firefox n'est pas redémarré (installation temporaire, non signée).

### Installer le .xpi directement (persistant, non signé)

Firefox release/ESR bloque par défaut l'installation d'un `.xpi` non signé par Mozilla. Pour tester en installation persistante sans passer par `about:debugging` :

1. Aller sur `about:config`.
2. Passer `xpinstall.signatures.required` à `false`.
3. Ouvrir/glisser le `.xpi` dans Firefox — l'install passe normalement.

⚠️ Uniquement sur Firefox Nightly / Developer Edition / ESR — ce pref n'existe pas (ou est verrouillé) sur Firefox release grand public. Et désactiver la vérification de signature désactive la protection pour **toutes** les extensions, pas que celle-ci — à remettre à `true` une fois les tests terminés.

## Structure

```
manifest.json     # Manifest V3 (Firefox, min. 109)
generator.js      # Moteur de génération (partagé background + options)
background.js     # Orchestration : icône, menus contextuels, stockage
content.js        # Détection des champs mot de passe + insertion dans la page
options.html/js   # Page de réglages
icons/
```

## Permissions utilisées

| Permission | Usage |
|---|---|
| `storage` | Sauvegarder les réglages et le dernier mot de passe généré |
| `menus` | Menus contextuels (icône + champs mot de passe) — **pas** `contextMenus`, qui ne donne accès qu'à un sous-ensemble de l'API |
| `activeTab` | Insérer le mot de passe dans l'onglet actif |
| `clipboardWrite` | Copier le dernier mot de passe généré |
| `host_permissions: <all_urls>` | Détecter les champs mot de passe sur n'importe quel site |

## Licence

À définir (MIT recommandé pour un petit projet perso).
