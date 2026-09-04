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
- Administration locale des termes (`/admin/terms`) : liste, création, édition, alias, suppression — sans Prisma Studio

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
npm test             # matching des termes + explication débutant (node:test)
npx prisma studio    # interface visuelle de la DB (optionnel)
```

L’enrichissement du catalogue de termes se fait dans l’application via **Administrer les termes** (`/admin/terms`). Prisma Studio n’est plus nécessaire pour ajouter ou modifier des termes en local.

Le seed des termes peut être relancé sans créer de doublons. Il ne modifie pas un terme déjà présent (label, description, `imagePath`) et n’écrase jamais un alias créé à la main. Un conflit (alias déjà code ou alias d’un autre terme) est signalé dans la console et l’alias n’est pas créé. Le seed n’est pas exécuté automatiquement au démarrage Docker.

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

Statuts des routes `/api/terms` : `400` données invalides, `404` identifiant introuvable, `409` collision code/alias, `500` erreur inattendue.

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
| `/admin/terms/[id]`          | Modifier ou supprimer un terme               |

## Aides dans le lecteur

Dans `/tutorials/[id]/play`, les **codes** et **alias** du catalogue (`ms`, `m.s.`, `maille serrée`, `6mc`…) sont mis en évidence et ouvrent une fiche (`<dialog>` natif). Le **label** d’un terme n’est reconnu que s’il existe aussi comme alias.

L’interrupteur **Afficher les aides** (case à cocher) est activé par défaut. Désactivé, le texte d’étape redevient du texte brut. Le réglage est conservé dans `localStorage` (`crochet-translator:show-term-helps`). Les fiches fonctionnent sans image (`imagePath` actuellement `null`).

Sous le patron original (jamais modifié), l’encadré **Explication débutant** reformule en français les formes **sûres** reconnues :

- quantité + terme connu (`1ms`, `2 ms`, `1 diminution`) ;
- bloc encadré `*…*`, `[…]` ou `(…)` **immédiatement** suivi de `xN` / `×N` ;
- total final `(N)` en fin d’instruction, présenté comme une indication du patron ;
- préfixe simple `R3 :`, `Rang 3 :`, `Tour 2 :`, `T3 :`.

Formulation des actions : `Fais 2 × Maille serrée.` (quantité lisible, **label exact** de la base, sans pluralisation). Si le format n’est pas reconnu, l’encadré affiche une note discrète et ne propose **aucune** interprétation. Les deux interrupteurs sont indépendants : l’explication continue si les aides cliquables sont désactivées. L’interrupteur **Explication débutant** est activé par défaut ; réglage dans `localStorage` (`crochet-translator:show-beginner-explanations`).

Non expliqué automatiquement : termes sans quantité, blocs sans `xN`, parenthèses isolées `(18)`, imbrications, phrases libres, anglais, fuzzy matching.

### Recette manuelle d’accessibilité

1. Ouvrir une fiche à la souris/tap, puis au clavier (Tab jusqu’au terme, Entrée).
2. Avec Tab et Shift+Tab, vérifier que le focus ne peut pas atteindre le toggle **Afficher les aides**, les boutons **Précédent** / **Suivant**, ni les autres contrôles derrière la modal.
3. Fermer avec Échap, avec le bouton **Fermer**, et avec un clic/tap sur l’arrière-plan.
4. Après chaque fermeture, vérifier que le focus revient exactement sur le terme qui a ouvert la fiche.
5. Refaire ce parcours sur Safari ou un navigateur mobile si disponible.
6. Si le `<dialog>` natif ne fournit pas ce comportement sur un navigateur cible : ne pas ajouter de bibliothèque ; noter le constat et corriger au minimum.
7. Vérifier les deux cases **Afficher les aides** et **Explication débutant** au clavier (Tab, Espace). L’encadré pédagogique reste lisible sans survol ; le texte du patron ne change jamais.
8. Désactiver les aides cliquables : l’explication débutant reste visible. Désactiver l’explication : les termes cliquables restent. Recharger la page : les deux préférences sont conservées.

## Structure du projet

```
crochet-translator/
├── app/                      # Pages et API routes (App Router)
│   ├── api/tutorials/        # POST + GET liste
│   ├── api/terms/            # CRUD termes et alias
│   ├── admin/terms/          # Administration locale des termes
│   ├── tutorials/[id]/       # Liste + lecteur play
│   └── page.tsx              # Accueil (formulaire)
├── components/               # Composants React réutilisables
│   ├── TutorialPlayer.tsx    # Lecteur + toggles aides / explication
│   ├── StepTermText.tsx      # Texte d'étape avec termes cliquables
│   ├── BeginnerExplanationPanel.tsx # Encadré explication débutant
│   ├── TermHelpModal.tsx     # Fiche d'aide (<dialog> natif)
│   └── admin/                # Formulaires et dialog de suppression
├── lib/
│   ├── db/prisma.ts          # Client Prisma singleton
│   ├── tutorials.ts          # Logique métier
│   ├── terms.ts              # Chargement + CRUD serveur des termes
│   ├── term-types.ts         # Types partagés admin / API
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
