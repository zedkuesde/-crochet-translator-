# Crochet Translator

Application web V1 pour transformer un patron de crochet collé en tutoriel pas à pas. Chaque ligne du patron devient une étape que l'on peut parcourir avec les boutons **Précédent** / **Suivant**.

Pas d'authentification : chaque tuto est identifié par un UUID accessible via l'URL.

**L’administration des termes (`/admin/terms` et `/api/terms`) n’a aucune authentification dans ce lot.** Elle est destinée à un usage local ou privé. Une URL peu visible n’est **pas** un mécanisme de sécurité. **Il est obligatoire d’ajouter une authentification avant toute exposition publique** de cette application.

## Stack technique

- **Front** : Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Back** : API Routes Next.js (Node)
- **Base de données** : Prisma + SQLite (migrations versionnées)
- **Déploiement** : Docker multi-stage (`node:20-alpine`) + docker-compose

## Fonctionnalités V1

- Coller un patron de crochet (texte brut, une ligne par rang)
- Découpage automatique en étapes (lignes vides ignorées)
- Liste des étapes d'un tuto
- Lecture pas à pas avec navigation Précédent / Suivant / Terminer
- Accès au tuto via URL (`/tutorials/[id]`)

## Fonctionnalités V2

- Catalogue de tutos (`/tutorials`) : liste tous les tutos par date décroissante
- Affichage : nom, nombre d'étapes, date en français
- Gestion de l'état vide
- Navigation cohérente entre accueil, catalogue, détail et lecteur
- Lecteur pas à pas : codes et alias reconnus, fiches d'aide, interrupteur **Afficher les aides**
- Lecteur pas à pas : encadré **Explication débutant** (notation simple, sans réécrire le patron)
- Administration locale des termes (`/admin/terms`) : liste, création, édition, alias, suppression, import JSON avec aperçu — sans Prisma Studio

## Développement local

### Prérequis

- Node.js 20+
- npm

### Installation et lancement

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) (ou le port affiché dans le terminal si 3000 est déjà utilisé, ex. `3001`).

### Base de données locale

Prisma résout les chemins SQLite relatifs depuis le dossier `prisma/`. Pour stocker la base à la racine du repo :

```env
DATABASE_URL="file:../db.sqlite"
```

Le fichier `db.sqlite` est ignoré par Git.

### Commandes utiles

```bash
npm run db:migrate   # prisma migrate dev
npm run db:deploy    # prisma migrate deploy (prod / Docker)
npm run db:seed      # seed idempotent des termes de crochet
npm test             # matching, collisions, explication débutant, import JSON (node:test)
npx prisma studio    # interface visuelle de la DB (optionnel)
```

L’enrichissement du catalogue de termes se fait dans l’application via **Administrer les termes** (`/admin/terms`) ou **Importer un fichier JSON** (`/admin/terms/import`). Prisma Studio n’est plus nécessaire pour ajouter ou modifier des termes en local.

Le seed des termes peut être relancé sans créer de doublons. Il ne modifie pas un terme déjà présent (label, description, `imagePath`) et n’écrase jamais un alias créé à la main. Un conflit (alias déjà code ou alias d’un autre terme) est signalé dans la console et l’alias n’est pas créé. Le seed n’est pas exécuté automatiquement au démarrage Docker.

L’import JSON est **additif et tout ou rien** : preview obligatoire, confirmation explicite, pas d’écrasement des fiches existantes, pas d’import partiel en cas de conflit. Le fichier choisi est lu dans le navigateur et copié dans la zone de texte ; seul ce texte est envoyé à l’API. Rien n’est stocké sur disque.

## Docker

Points importants du build multi-stage :

- Le stage `deps` copie `prisma/` avant `npm ci`, car le script `postinstall` lance `prisma generate`.
- Un stage `prisma-cli` installe le CLI Prisma (avec ses dépendances et moteurs Alpine) hors du bundle Next standalone.
- Au démarrage, l’entrypoint : crée `/app/data`, corrige les permissions pour l’utilisateur `nextjs` (uid 1001), exécute `prisma migrate deploy`, puis lance `node server.js`.

### Build

```bash
docker build -t crochet-translator .
```

### Lancer

```bash
docker compose up -d
```

Accéder à [http://localhost:3000](http://localhost:3000).

### Rebuild sans cache (VPS)

```bash
docker compose build --no-cache
docker compose up -d --force-recreate
docker compose logs -f app
```

### Logs et arrêt

```bash
docker compose logs -f app
docker compose down
```

La base SQLite est persistée dans `./data` (monté sur `/app/data` dans le conteneur) :

```env
DATABASE_URL=file:/app/data/db.sqlite
```

## Schéma de la base

### `Tutorial`

| Champ       | Type     | Description                        |
|-------------|----------|------------------------------------|
| `id`        | UUID     | Identifiant unique (clé primaire)  |
| `name`      | string?  | Nom du projet (optionnel)          |
| `rawText`   | string   | Texte brut collé                   |
| `createdAt` | datetime | Date de création                   |

### `Step`

| Champ        | Type     | Description                         |
|--------------|----------|-------------------------------------|
| `id`         | UUID     | Identifiant unique                  |
| `tutorialId` | UUID     | Référence vers `Tutorial` (cascade) |
| `index`      | int      | Numéro d'étape (1, 2, 3…)           |
| `label`      | string   | Texte de l'étape                    |
| `createdAt`  | datetime | Date de création                    |

Relation : un `Tutorial` possède plusieurs `Step` (1-N).

### `CrochetTerm`

Fiches pédagogiques des abréviations françaises, utilisées dans le lecteur pas à pas.

| Champ         | Type     | Description                                      |
|---------------|----------|--------------------------------------------------|
| `id`          | UUID     | Identifiant unique                               |
| `code`        | string   | Code canonique unique, minuscule (`ms`, `aug`)   |
| `label`       | string   | Nom complet (`Maille serrée`)                    |
| `description` | string?  | Explication courte pour débutant                 |
| `imagePath`   | string?  | Chemin d’image (`/stitches/ms.webp`) ou `null`   |
| `createdAt`   | datetime | Date de création                                 |
| `updatedAt`   | datetime | Mis à jour automatiquement                       |

### `CrochetTermAlias`

Variantes d’écriture qui pointent vers une seule fiche.

| Champ             | Type     | Description                                      |
|-------------------|----------|--------------------------------------------------|
| `id`              | UUID     | Identifiant unique                               |
| `alias`           | string   | Forme saisie (`m.s.`, `augm`)                    |
| `aliasNormalized` | string   | Clé unique (minuscule, espaces compactés, NFC)   |
| `termId`          | UUID     | Référence vers `CrochetTerm` (cascade)           |
| `createdAt`       | datetime | Date de création                                 |

Relation : un `CrochetTerm` possède plusieurs `CrochetTermAlias` (1-N). Le `code` du terme est aussi une expression reconnue, sans le dupliquer en alias.

L’unicité SQL porte séparément sur `CrochetTerm.code` et `CrochetTermAlias.aliasNormalized`. **Il n’existe pas de contrainte SQL transversale** entre un code et un alias d’un autre terme : les collisions `code ↔ alias` sont contrôlées dans `lib/terms.ts` (dans une transaction). Une course rare entre deux écritures simultanées n’est donc pas garantie par la base.

Seed initial (8 termes, `imagePath` toujours `null`) : `ml`, `mc`, `ms`, `db`, `br`, `dbr`, `aug`, `dim`.

## Routes API

| Méthode | Route                                  | Description                               |
|---------|----------------------------------------|-------------------------------------------|
| `POST`  | `/api/tutorials`                       | Crée un tuto + ses étapes                 |
| `GET`   | `/api/tutorials/[id]`                  | Récupère un tuto avec ses étapes triées   |
| `GET`   | `/api/tutorials`                       | Liste tous les tutos (debug)              |
| `GET`   | `/api/terms`                           | Liste les termes (tri par code)           |
| `POST`  | `/api/terms`                           | Crée un terme et ses alias initiaux       |
| `GET`   | `/api/terms/[id]`                      | Détail d’un terme                         |
| `PATCH` | `/api/terms/[id]`                      | Met à jour code, label, description, image |
| `DELETE`| `/api/terms/[id]`                      | Supprime un terme et ses alias            |
| `POST`  | `/api/terms/[id]/aliases`              | Ajoute un alias                           |
| `DELETE`| `/api/terms/[id]/aliases/[aliasId]`    | Supprime un alias                         |
| `POST`  | `/api/terms/import/preview`            | Valide un JSON V1 et calcule l’aperçu     |
| `POST`  | `/api/terms/import/commit`             | Importe après confirmation (tout ou rien) |

Statuts des routes `/api/terms` : `400` données invalides, `404` identifiant introuvable, `409` collision code/alias, `500` erreur inattendue.

Statuts import : `400` JSON/schéma/hashes invalides (`invalid_json`, `invalid_document`, `payload_changed`), `409` catalogue changé ou conflits (`catalog_changed`, `conflicts`), `500` erreur inattendue. Preview avec conflits métier : `200` et `canCommit: false`.

Les routes `/api/terms*` sont ouvertes (pas d’authentification). Ne pas les exposer publiquement sans protection.

### Exemple

```bash
curl -X POST http://localhost:3000/api/tutorials \
  -H "Content-Type: application/json" \
  -d '{"rawText":"R1: 6mc\nR2: 2ms dans chaque maille (12)","name":"Mon projet"}'
```

Réponse : `{"id":"<uuid>"}`

## Pages UI

| Route                        | Description                      |
|------------------------------|----------------------------------|
| `/`                          | Créer un tuto                    |
| `/tutorials`                 | Catalogue de tous les tutos      |
| `/tutorials/[id]`            | Liste des étapes d'un tuto       |
| `/tutorials/[id]/play?step=` | Lecture pas à pas, aides termes + explication débutant |
| `/admin/terms`               | Liste des termes (tri alphabétique par code) |
| `/admin/terms/new`           | Créer un terme                               |
| `/admin/terms/import`        | Importer un JSON (preview + confirmation)    |
| `/admin/terms/[id]`          | Modifier ou supprimer un terme               |

## Aides dans le lecteur

Dans `/tutorials/[id]/play`, les **codes** et **alias** du catalogue (`ms`, `m.s.`, `maille serrée`, `6mc`…) sont mis en évidence et ouvrent une fiche (`<dialog>` natif). Le **label** d’un terme n’est reconnu que s’il existe aussi comme alias.

L’interrupteur **Afficher les aides** (case à cocher) est activé par défaut. Désactivé, le texte d’étape redevient du texte brut. Le réglage est conservé dans `localStorage` (`crochet-translator:show-term-helps`). Les fiches fonctionnent sans image (`imagePath` actuellement `null`).

Sous le patron original (jamais modifié), l’encadré **Explication débutant** reformule en français les formes **sûres** reconnues :

- quantité + terme connu (`1ms`, `2 ms`, `1 diminution`) ;
- bloc encadré `*…*`, `[…]` ou `(…)` **immédiatement** suivi de `xN` / `×N` ;
- bloc parenthésé `(…)` suivi de `N fois` (`N` de 1 à 999), uniquement avec **au moins deux** actions simples sans qualificatif — restriction volontaire du jalon G, pas un jugement sur la notation crochet ;
- sandwich contrôlé `séquence, (séquence) N fois, séquence` : une seule paire de parenthèses centrale, au moins une action simple avant et après, au moins deux actions simples dans le bloc, aucun qualificatif — affiché en trois sections toujours titrées (`Avant la répétition :`, `Répète N fois :`, `Après la répétition :`) même si avant ou après n’a qu’une action ;
- total final `(N)` ou `[N]` en toute fin d’instruction (entier ASCII 1–9999), présenté comme une indication du patron, sans aucun calcul ;
- préfixe simple `R3 :`, `Rang 3 :`, `Tour 2 :`, `T3 :` ;
- plage explicite `Tours A-B (N tours) :` ou `Rangs A-B (N rangs) :` (`A`, `B`, `N` entiers ASCII 1–999, mot pluriel obligatoire, accord tours/rangs, deux-points obligatoire). Tiret accepté : `-` ASCII ou `–` demi-cadratin uniquement. `A <= B` est une validation de forme ; `N` est recopié tel quel, jamais calculé ni corrigé depuis `A`/`B`. Le corps est une séquence simple d’actions (virgules possibles), sans bloc `xN`, sans `(…) N fois`, sans `, à répéter`, sans « jusqu’à la fin », sans `;`, sans parenthèse ou crochet dans le corps. Qualificatif de plage limité à `dans chaque maille` / `dans toutes les mailles` / `dans chaque m` / `dans toutes les m` ; `dans la maille suivante` et `anneau magique` restent refusés sur une plage ;
- qualificatif d’action simple, immédiatement après `quantité + terme` : `dans chaque maille`, `dans toutes les mailles`, `dans la maille suivante`, `dans la prochaine maille`, les variantes contextuelles `dans chaque m` / `dans toutes les m` (le `m` n’est **pas** un code du dictionnaire), et le placement de démarrage `dans un anneau magique` (variantes d’entrée `dans une boucle magique` / `dans un cercle magique`, rendu toujours canonique `dans un anneau magique`) ;
- suffixe final `jusqu’à la fin du rang` ou `jusqu’à la fin du tour` (apostrophe ASCII ou typographique), uniquement sur une séquence d’**au moins deux** actions séparées par virgule, avant le total `(N)` / `[N]` éventuel ;
- suffixe final `, à répéter N fois` (`N` de 1 à 999), uniquement sur une séquence d’**au moins deux** actions simples sans qualificatif, avant le total `(N)` / `[N]` éventuel.

Formulation des actions : `Fais 2 × Maille serrée.` (quantité lisible, **label exact** de la base, sans pluralisation). Un qualificatif s’affiche après le label, en forme canonique (`dans chaque maille` / `dans la maille suivante` / `dans un anneau magique`). Le suffixe « jusqu’à la fin » produit `Répète jusqu’à la fin du rang/tour :`, jamais un nombre de répétitions. Une plage produit `Pour les tours 6 à 9 :` puis `Fais la même instruction pendant N tours :` (`N` = nombre **écrit** entre parenthèses, pas `B − A + 1`). Le total d’une plage se lit `Le patron indique N mailles pour cette plage de tours/rangs.`, jamais « à la fin de chacun de ces tours ». Si au moins une action a un qualificatif de position, une note de prudence rappelle que l’application ne calcule ni le nombre de mailles ni la position exacte.

Exemples réels (totaux **écrits** dans le patron, jamais calculés ni corrigés) :

- `Tour 1 : 8 ms dans un anneau magique[2]` → « Pour le tour 1 : », `Fais 8 × Maille serrée dans un anneau magique.`, note de prudence, total recopié `2`.
- `Tour 3 : (1 ms, 1 aug) 8 fois[2]` → « Pour le tour 3 : », `Répète 8 fois :`, deux actions, total recopié `2`.
- `Tour 15 : 7 ms, 1 aug, 4 ms, 1 aug, (7 ms, 1 aug) 2 fois, 1 ms, 1 aug, 7 ms, 1 aug[3]` → trois sections titrées, total recopié `3` (pas un calcul de mailles).
- `Tour 17 : 7 ms, 1 dim, 4 ms, 1 dim, (7 ms, 1 dim) 2 fois, 1 ms, 1 dim, 7 ms, 1 dim` → mêmes trois sections, sans ligne de total.
- `Tours 6-9 (4 tours) : 1 ms dans chaque m[1]` → « Pour les tours 6 à 9 : », `Fais la même instruction pendant 4 tours :`, `Fais 1 × Maille serrée dans chaque maille.`, note de prudence, total de plage recopié `1`.
- `Tours 30-32 (3 tours) : 1 ms dans chaque m` → mêmes titres de plage, sans ligne de total.
- `Rangs 2-4 (3 rangs) : 2 ms dans chaque maille (12)` → « Pour les rangs 2 à 4 : », `pendant 3 rangs`, total de plage recopié `12`.

La forme collée sans espace avant le crochet (`Tour 1 : 8 ms dans un anneau magique[1]`) reste reconnue. Le qualificatif n’est admis que sur **une action unique**, hors répétition (`xN`, `(…) N fois`, sandwich, `, à répéter`, `jusqu’à la fin`) et hors séquence à virgule, sauf `dans chaque maille` / `dans toutes les mailles` / `dans chaque m` / `dans toutes les m` sur une plage. Un sandwich n’accepte aucun qualificatif. Une plage n’accepte ni `xN`, ni `(…) N fois`, ni sandwich.

`dans un anneau magique` est une expression en toutes lettres reconnue par le parseur uniquement. Elle n’ajoute pas `am`, `cm`, `m`, `MR` ni `mc` au dictionnaire, n’est pas un alias global, et n’est pas un lien cliquable automatique. L’aide cliquable d’un terme « Anneau magique » est un sujet distinct : le jalon fonctionne sans ce terme en base.

Le suffixe « jusqu’à la fin » doit correspondre au préfixe : `Rang`/`R` uniquement avec `rang`, `Tour`/`T` uniquement avec `tour`. Sans préfixe, le suffixe reste acceptable s’il nomme lui-même `rang` ou `tour`. Le suffixe `, à répéter N fois` et la forme `(…) N fois` réutilisent la même formulation que `xN` (`Répète 6 fois :`). Le sandwich ajoute les titres `Avant la répétition :` et `Après la répétition :` autour de `Répète N fois :`. `(…) N fois` entier ou en sandwich n’est jamais combiné avec `xN`, « jusqu’à la fin » ou `, à répéter N fois`. Un `[N]` final n’est pas confondu avec un bloc `[actions] xN` : seul le crochet numérique tout en fin d’instruction est un total.

`m` n’est reconnu que comme dernier mot des qualificatifs `dans chaque m` et `dans toutes les m`. Il n’est pas ajouté au catalogue, n’est pas cliquable dans le patron, et s’affiche toujours sous la forme canonique `dans chaque maille`.

Si le format n’est pas reconnu, l’encadré affiche une note discrète et ne propose **aucune** interprétation. Les deux interrupteurs sont indépendants : l’explication continue si les aides cliquables sont désactivées. L’interrupteur **Explication débutant** est activé par défaut ; réglage dans `localStorage` (`crochet-translator:show-beginner-explanations`).

Non expliqué automatiquement : termes sans quantité, blocs sans `xN` ni `N fois`, parenthèses isolées `(18)`, imbrications, phrases libres, anglais, fuzzy matching, ponctuation inattendue, une seule action suivie de « jusqu’à la fin » ou de `, à répéter N fois`, **une seule action** dans `(1 ms) 8 fois` (simplification volontaire du jalon G : la notation existe dans les patrons, le parseur ne la prend pas encore en charge), combinaison `xN` + « jusqu’à la fin » ou `xN` + `, à répéter N fois` ou `(…) N fois` + un autre mécanisme de répétition, qualificatif avec `, à répéter N fois` ou à l’intérieur d’un bloc répété, `répéter 6 fois` sans `à`, `à répéter six fois`, deux totaux (`(6)[6]`, `8 ms dans un anneau magique (8)[1]`), texte dans les crochets (`[24 mailles]`), désaccord préfixe/suffixe (`Tour` + `rang`, `Rang` + `tour`), `dans les 3 mailles suivantes`, `dans chaque coin`, `dans le brin arrière`, `dans l’arceau`, `dans la même maille`, `dans l’anneau magique`, `dans un anneau`, `dans une boucle`, `autour de l’anneau magique`, `am` / `cm` / `magic ring` / `MR` / `mc` comme placement, `8 ms dans un anneau magique, 1 aug[3]`, `(8 ms dans un anneau magique, 1 aug) 2 fois[2]`, `8 ms dans un anneau magique jusqu’à la fin du tour[1]`, `Tour 6-9` (singulier), `Tours 6 à 9`, `Tours 9-6` (bornes inversées), `Tours 6-9` sans `(N tours)`, désaccord `Tours`/`rangs`, `(…) N fois` ou `, à répéter` ou « jusqu’à la fin » dans une plage, `dans la maille suivante` ou anneau magique dans une plage, changements de couleur (`; fil blanc`, Tour 19), sandwich incomplet (sans avant, sans après), sandwich avec `xN` / « deux fois » / qualificatif / anneau magique / point ou texte résiduel / deux blocs parenthésés / parenthèses imbriquées, `changer de couleur`, `tourner`, `joindre avec une mc`, `répéter jusqu’au marqueur`, `répéter jusqu’à la fin`. Le parseur n’invente jamais un total : `[N]` et `(N)` sont recopiés tels quels. Un test technique isolé vérifie qu’un `[6]` volontairement incohérent affiche `6`, jamais `54`. Un autre test isolé, clairement nommé « recopie le nombre de tours déclaré sans le recalculer », vérifie que `Tours 6-9 (3 tours) : 1 ms dans chaque m[1]` affiche `Fais la même instruction pendant 3 tours :` sans recalculer `4`. Ce cas est une preuve de fidélité au texte, pas un modèle de patron réel. `N` déclaré n’est jamais comparé à `B − A + 1`. Un `[40]` écrit est recopié tel quel.

### Recette manuelle d’accessibilité

1. Ouvrir une fiche à la souris/tap, puis au clavier (Tab jusqu’au terme, Entrée).
2. Avec Tab et Shift+Tab, vérifier que le focus ne peut pas atteindre le toggle **Afficher les aides**, les boutons **Précédent** / **Suivant**, ni les autres contrôles derrière la modal.
3. Fermer avec Échap, avec le bouton **Fermer**, et avec un clic/tap sur l’arrière-plan.
4. Après chaque fermeture, vérifier que le focus revient exactement sur le terme qui a ouvert la fiche.
5. Refaire ce parcours sur Safari ou un navigateur mobile si disponible.
6. Si le `<dialog>` natif ne fournit pas ce comportement sur un navigateur cible : ne pas ajouter de bibliothèque ; noter le constat et corriger au minimum.
7. Vérifier les deux cases **Afficher les aides** et **Explication débutant** au clavier (Tab, Espace). L’encadré pédagogique reste lisible sans survol ; le texte du patron ne change jamais. Sur une ligne avec qualificatif (`dans chaque maille`, `dans chaque m` ou `dans un anneau magique`), la note de prudence apparaît ; sur une ligne jalon D sans qualificatif, elle n’apparaît pas.
8. Désactiver les aides cliquables : l’explication débutant reste visible. Désactiver l’explication : les termes cliquables restent. Recharger la page : les deux préférences sont conservées.
9. Coller un patron amigurumi réel et vérifier : `Tour 1 : 8 ms dans un anneau magique[2]` (rendu canonique `dans un anneau magique`, note de prudence, total recopié `2`) ; « anneau magique » n’est pas cliquable ; `Tour 3 : (1 ms, 1 aug) 8 fois[2]` (une section `Répète 8 fois :`, total recopié `2`) ; `Tour 11 : 1 ms dans chaque m` reste expliqué et le `m` n’est pas cliquable ; `Tour 15 : 7 ms, 1 aug, 4 ms, 1 aug, (7 ms, 1 aug) 2 fois, 1 ms, 1 aug, 7 ms, 1 aug[3]` affiche trois sections titrées et le total recopié `3` ; `Tour 17 : 7 ms, 1 dim, 4 ms, 1 dim, (7 ms, 1 dim) 2 fois, 1 ms, 1 dim, 7 ms, 1 dim` affiche les mêmes trois titres sans ligne de total ; `1 ms, (2 ms, 1 aug) 3 fois, 1 dim[4]` garde trois sections même avec une seule action avant et après ; `Tour 19 : 1 ms, 1 dim, 3 ms, 1 dim, 2 ms ; fil blanc : 1 ms, 1 dim, (3 ms, 1 dim) 2 fois, 2 ms[6]` reste non expliqué (aucune liste partielle). Vérifier les plages réelles : `Tours 6-9 (4 tours) : 1 ms dans chaque m[1]` (titres de plage, note de prudence, total de plage recopié `1`) ; `Tours 30-32 (3 tours) : 1 ms dans chaque m` (mêmes titres, sans total) ; `Rangs 2-4 (3 rangs) : 2 ms dans chaque maille (12)` (total de plage recopié `12`). Seule preuve artificielle de non-correction : `Tours 6-9 (3 tours) : 1 ms dans chaque m[1]` affiche `Fais la même instruction pendant 3 tours :` sans recalculer `4`. Le texte du patron ne change jamais. Le total affiché et le `N` de « pendant N tours » sont ceux écrits dans le patron, jamais un calcul.

## Import JSON des termes

Page : `/admin/terms/import`. Format V1 obligatoire :

```json
{
  "format": "crochet-translator-terms",
  "version": 1,
  "terms": [
    {
      "code": "cm",
      "label": "Cercle magique",
      "description": "Boucle ajustable pour démarrer un ouvrage en rond.",
      "imagePath": null,
      "aliases": ["cercle magique", "anneau magique"]
    }
  ]
}
```

Politique : additif, idempotent, sans écrasement. Si un `code` existe déjà, label / description / `imagePath` restent intacts ; seuls les alias nouveaux disponibles peuvent être ajoutés. Un conflit (code déjà alias, alias déjà code ou déjà lié à un autre terme) bloque tout l’import. Pas d’option d’écrasement ni d’import partiel.

Le commit renvoie le même `jsonText` que l’aperçu, plus `payloadHash` et `catalogFingerprint` (SHA-256). Le serveur recalcule les deux dans une transaction Prisma avant toute écriture. Si le JSON ou le dictionnaire a changé, l’import est refusé.

Limites validées côté serveur : JSON brut 1 Mo ; 500 termes ; 50 alias par terme ; `code` 64 caractères ; `label` / alias 120 ; `description` 2000 ; `imagePath` 255. Les champs inconnus sont rejetés. `imagePath` n’est pas vérifié sur le disque.

Les tests automatisés couvrent le parseur, les limites, le plan (idempotence, collisions, hashes). Ils ne lancent pas Prisma : pas de base temporaire dans `npm test`. Vérifier manuellement le commit, le re-import, un conflit, un catalogue modifié entre preview et commit, et qu’une erreur n’écrit rien.

### Recette manuelle d’import

1. Ouvrir `/admin/terms`, cliquer **Importer un fichier JSON**.
2. Choisir un fichier `.json` : le contenu apparaît dans la zone de texte, qui reste éditable ; statut `Contenu chargé depuis : …`.
3. Modifier le textarea, relancer **Vérifier et prévisualiser**.
4. Coller un JSON sans fichier : même validation.
5. Cas d’erreur (mauvais `format`, alias vide) : zone `role="alert"`, pas de bouton d’import.
6. Preview sans conflit avec des créations : **Confirmer l’import**, dialog (Annuler, Échap, clic backdrop, focus).
7. Après succès : message `role="status"` et lien vers `/admin/terms`.
8. Re-importer le même fichier : termes inchangés, alias déjà présents, rien à écrire.
9. JSON en conflit (code déjà alias, alias déjà code) : bouton d’import absent, JSON conservé.
10. Preview, puis modifier un terme dans l’admin, puis confirmer l’ancien aperçu : l’API refuse (`catalog_changed`) ; relancer la prévisualisation.

## Structure du projet

```
crochet-translator/
├── app/                      # Pages et API routes (App Router)
│   ├── api/tutorials/        # POST + GET liste
│   ├── api/terms/            # CRUD termes, alias, import JSON
│   ├── admin/terms/          # Administration locale des termes + import
│   ├── tutorials/[id]/       # Liste + lecteur play
│   └── page.tsx              # Accueil (formulaire)
├── components/               # Composants React réutilisables
│   ├── TutorialPlayer.tsx    # Lecteur + toggles aides / explication
│   ├── StepTermText.tsx      # Texte d'étape avec termes cliquables
│   ├── BeginnerExplanationPanel.tsx # Encadré explication débutant
│   ├── TermHelpModal.tsx     # Fiche d'aide (<dialog> natif)
│   └── admin/                # Formulaires, import JSON, dialogs
├── lib/
│   ├── db/prisma.ts          # Client Prisma singleton
│   ├── tutorials.ts          # Logique métier
│   ├── terms.ts              # Chargement + CRUD serveur des termes
│   ├── term-types.ts         # Types partagés admin / API
│   ├── terms-import.ts       # Parse V1, plan, preview, commit
│   ├── terms-import-constants.ts # Limites et format JSON
│   ├── terms-import.test.ts  # Tests parse / plan / hashes
│   ├── crochet-terms.ts      # Normalisation + segmentation
│   ├── crochet-terms.test.ts # Tests du matcher
│   ├── beginner-explanation.ts      # Parseur pédagogique déterministe
│   ├── beginner-explanation.test.ts # Tests du parseur débutant
│   └── terms.test.ts         # Tests validation et collisions
├── prisma/
│   ├── schema.prisma         # Schéma de données
│   ├── seed.ts               # Seed idempotent des termes FR
│   └── migrations/           # Migrations SQL versionnées
├── scripts/
│   └── docker-entrypoint.sh  # Entrypoint Docker
├── data/                     # Volume SQLite Docker (gitignoré)
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Déploiement sur VPS

1. Cloner le repo sur le serveur.
2. Lancer avec docker-compose :

```bash
docker compose up -d --build
```

3. Persister la base via le volume `./data` (déjà configuré dans `docker-compose.yml`).
4. Exposer le port **3000** derrière un reverse proxy (nginx, Caddy, Traefik…) pour servir l'app en HTTPS.

Exemple minimal avec Caddy (à adapter) :

```
tuto.example.com {
  reverse_proxy localhost:3000
}
```

## Licence

Projet personnel — V1.
