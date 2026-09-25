# Le Raider — guide pour Claude Code

Simulation boursière et capitalistique inspirée de *Wall Street Raider*. Le joueur part avec 25 M€ et affronte trois raiders pilotés par l'IA, qui démarrent avec la même somme et jouent selon les mêmes règles. Il achète des titres, lance des OPA et des OPE, prend le contrôle de sociétés, les pilote (dette, dividendes, investissement, fusions, augmentations de capital, obligations), s'en fait élire PDG et crée ses propres sociétés.

Tout le jeu est en français : interface, messages d'erreur, journal, noms de fonctions et de variables, commentaires. Garder cette cohérence.

## Commandes

| Commande | Effet |
|---|---|
| `npm install` | Dépendances |
| `npm run dev` | Jeu dans le navigateur, http://localhost:5173 |
| `npm test` | Suite complète (environ 40 s) : moteur, parties aléatoires, rendu de l'interface |
| `node --test tests/offres.test.mjs` | Un seul fichier de tests |
| `npm run equilibrage` | Banc d'essai de l'équilibre (plusieurs minutes), à comparer aux repères ci-dessous |
| `npm run build` | Version web dans `dist/` |
| `npm run app:dev` / `npm run app:build` | Application de bureau Tauri (Rust et, sous Linux, WebKitGTK requis) |

`npm test` doit passer avant chaque commit.

## Architecture

```
src/engine/     moteur du jeu, JavaScript pur, sans dépendance ni accès au DOM
  index.js      réexporte tout ; l'interface et les tests importent depuis ici
  config.js     constantes (impôt, marge, seuils, prime du noyau dur), raiders, acteurs
  alea.js       aléa déterministe (mulberry32) : une graine = une partie reproductible
  secteurs.js   10 secteurs + holding ; noms des 50 sociétés
  finance.js    dette bancaire et obligataire, levier, notation, taux, capacité d'emprunt
  acces.js      sociétés actives, capitalisation, détentions, fortune
  controle.js   règle de contrôle, groupes de vote, cascade, autocontrôle
  valorisation.js  prix cible (valeur fondamentale), PER, résultat
  univers.js    nouvellePartie(graine, { nbTours })
  creation.js   création de sociétés et holdings ; journal()
  transactions.js  débit/crédit, antitrust, aperçus d'achat et de vente
  marche.js     acheter, vendre, lancerOPA (OPA, OPE, offres mixtes), apporter à une offre
  pilotage.js   emprunter, rembourser, dividendes, rachat d'actions, investir, céder, restructurer, fusionner
  emission.js   augmentations de capital (public, droit préférentiel, placement privé)
  obligations.js  classiques, haut rendement, convertibles ; échéances, défaut
  dirigeants.js mandats de PDG : fixe, bonus, stock-options
  trimestre.js  finTrimestre() : conjoncture, événements, exploitation, échéances, faillites, cours, mandats
  courtage.js   intérêts de marge et appels de marge des acteurs
  ia.js         comportement des trois raiders
  invariants.js verifierInvariants()
src/ui/         composants React (un par écran ou fenêtre), format.js pour les nombres
src/App.jsx     navigation, sauvegarde automatique
src/sauvegarde.js  localStorage ; CLE à incrémenter quand la forme de l'état change
src-tauri/      application de bureau (Tauri 2) : une fenêtre native qui charge dist/
public/         manifeste, service worker et icônes de la version web installable
scripts/        equilibrage.mjs (banc d'essai), icone.py (régénère les icônes)
tests/          node:test, sans dépendance ; outils.mjs contient les aides communes
```

### Principes du moteur

- **L'état est un objet JSON sérialisable** (`s`) : sociétés, joueur, raiders, journal. Il est sauvegardé tel quel.
- **Les fonctions publiques sont pures** : elles clonent l'état (`structuredClone`), le modifient et renvoient le clone. L'interface fait `setS(acheter(s, ...))`.
- **Un refus est une `Error` au message lisible en français**, affichée telle quelle dans la fenêtre d'ordre. Une `TypeError` ou une `ReferenceError` est toujours un bug : le test des parties aléatoires les distingue.
- **Aucun `Math.random` dans le moteur**, sauf la graine par défaut de `nouvellePartie`. Tout aléa passe par `rngDe(s)`, qui avance `s.graine`. Une même suite d'actions sur une même graine donne exactement la même partie.
- **Unités** : montants en M€, nombres d'actions en millions, prix en €. `capi = actions × prix`.
- **Chaque fonction d'action a son aperçu** (`apercuOPA`, `apercuEmission`, `apercuObligations`, `apercuMandat`, `apercuCreation`) qui calcule sans modifier. L'interface affiche l'aperçu avant confirmation, et le test `offres.test.mjs` vérifie que l'aperçu et l'exécution concordent.
- **Journal** : `journal(s, type, texte, acteur)`, où `acteur` vaut `'J'`, `'R1'`–`'R3'` ou `'marche'`. Le bilan et les filtres du journal comptent les entrées par expression régulière sur le texte : un changement de formulation peut casser un compteur du bilan (`src/ui/Bilan.jsx`).

### Invariants (`src/engine/invariants.js`)

Pour chaque société active : la somme des détentions égale le nombre d'actions ; aucune détention négative ; prix, actions et comptes finis et positifs ; une société ne se détient pas elle-même ; toute obligation a un nominal positif. Trésorerie et marge du joueur et des raiders positives et finies.

## Règles du jeu, telles qu'implémentées

- **Contrôle** (`controle.js`) : un groupe contrôle une société avec 50 % des votes, ou 25 % si aucun autre bloc n'atteint 25 %. Un groupe réunit vous, un raider, une famille (le noyau dur) ou une société que personne ne contrôle, avec tout ce qu'il contrôle en cascade. Les titres détenus sur ses propres contrôleurs (autocontrôle) ne votent pas. `repartitionControle(s)` calcule tout par itération ; dans une boucle, le calculer une fois et passer `ctl` (paramètre optionnel de `apercuOPA`, `controlees`, `simulerControle`).
- **Offres** : le flottant apporte selon une logistique de la prime ; le noyau dur n'apporte qu'à partir de 30 % ; chaque raider a son seuil. Paiement en titres (OPE ou offre mixte) seulement au nom d'une société contrôlée, avec émission de ses actions au cours ; le papier compte 5 points de prime de moins que les espèces. Antitrust au-delà de 50 % du CA d'un secteur.
- **Marge** : dette ≤ 50 % du portefeuille ; appel de marge au-delà de 60 %, blocs cédés à 15 % de décote.
- **Croissance** : investir ou créer une société ajoute un CA « en construction » qui entre en service en deux ans environ ; 1 € investi vaut environ 1,15 € à maturité quel que soit le secteur (`RENDEMENT_INVEST`), et le marché en valorise 75 % tout de suite (`ANTICIPATION`).
- **Holdings** : valorisées à leur actif net moins 10 % ; empruntent jusqu'à 50 % de la valeur de leurs participations ; covenant bancaire à 75 % de LTV.
- **Augmentations de capital** : au plus tous les 4 trimestres, jamais plus du double des actions, 3 % de frais. Droit préférentiel neutre en valeur ; placement privé soumis à l'estimation du raider.
- **Obligations** : taux fixe, remboursées à l'échéance (5, 7 ou 10 ans), sans covenant. Classique jusqu'à 4× l'EBIT, haut rendement jusqu'à 6×, convertible jusqu'à 5× avec conversion à +30 %. À l'échéance : trésorerie, puis banque ; sinon défaut, les porteurs convertissent le reliquat en actions à la moitié du cours.
- **Dirigeants** : au plus 5 présidences. Fixe = 0,1 + 0,03 × √CA (M€/an), plafonné à 8 % de l'EBIT ; bonus 0 à 150 % du fixe (croissance de l'EBIT et bourse contre l'indice) ; options annuelles levables à 3 ans en règlement net. Révocation automatique si le contrôle change de mains.
- **Raiders** (`ia.js`) : Vauclair (valeur, sans dette), Lemarchand (OPA à crédit, filiales endettées et vidées), Meridian (se glisse dans les cibles du joueur). Ils agissent à la clôture, après les ordres du joueur, avec au plus un achat, une vente et une OPA par trimestre. Les ordres de l'IA passent par `appliquer()`, qui avale les refus : pour voir les erreurs, `globalThis.DEBUG_RAIDER = true`.

## Équilibre : repères actuels

`npm run equilibrage` (12 graines, 20 ans, 25 M€ au départ). Ordre de grandeur des médianes à conserver sauf changement délibéré :

| Acteur | Médiane (M€) | Remarque |
|---|---|---|
| Indice (acheter tout, ne rien faire) | ~140 | ≈ 6 % par an hors dividendes |
| Value (PER) | ~450 | |
| Bâtisseur (société tech + réinvestissement) | ~250 | |
| Raider joueur | ~600–850 | la règle des 25 % rend le raid dominant |
| Raider + haut rendement | ~700–1000 | médiane plus haute, pire cas divisé par deux, défauts fréquents |
| Vauclair / Lemarchand / Meridian (IA) | ~320 / ~600–800 / ~570–700 | |

Un changement qui déplace une médiane de plus de 30 % doit être expliqué dans le message de commit.

## Pièges connus

- **Imports circulaires entre modules du moteur** : ils sont nombreux et sans danger tant qu'aucun module n'utilise un nom importé *au chargement*. Pas d'alias du type `const x = fonctionImportee;` au premier niveau : écrire `const x = (...a) => fonctionImportee(...a)`.
- **Tests de rendu** (`interface.test.mjs`) : le rendu serveur de React découpe le texte autour des variables (`PDG : <!-- -->vous`). Chercher des fragments qui ne chevauchent pas une variable.
- **Sauvegarde** : toute modification de la forme de l'état (nouveau champ indispensable, champ renommé) impose d'incrémenter `CLE` dans `src/sauvegarde.js`, sinon une ancienne partie rechargée plantera.
- **Performance** : `repartitionControle` coûte environ 0,2 ms ; l'appeler dans une boucle sur 50 sociétés × plusieurs primes reste raisonnable, mais pas à l'intérieur de boucles imbriquées.

## Pistes

- Faire émettre du haut rendement à Lemarchand (cohérent avec son profil, mais le renforce).
- Exporter et importer une sauvegarde en fichier (utile entre la version web et l'application Mac).
- Signer et notariser l'application Mac (compte Apple Developer) pour supprimer l'avertissement au premier lancement.
- Événements plus riches (krach, bulle sectorielle, enquête de l'AMF sur un raider).
