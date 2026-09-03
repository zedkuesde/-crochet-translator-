# Crochet Translator

Application web V1 pour transformer un patron de crochet collé en tutoriel pas à pas. Chaque ligne du patron devient une étape que l'on peut parcourir avec les boutons **Précédent** / **Suivant**.

Pas d'authentification : chaque tuto est identifié par un UUID accessible via l'URL.

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
npx prisma studio    # interface visuelle de la DB
```

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

## Routes API

| Méthode | Route                 | Description                               |
|---------|-----------------------|-------------------------------------------|
| `POST`  | `/api/tutorials`      | Crée un tuto + ses étapes                 |
| `GET`   | `/api/tutorials/[id]` | Récupère un tuto avec ses étapes triées   |
| `GET`   | `/api/tutorials`      | Liste tous les tutos (debug)              |

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
| `/tutorials/[id]/play?step=` | Lecture pas à pas                |

## Structure du projet

```
crochet-translator/
├── app/                      # Pages et API routes (App Router)
│   ├── api/tutorials/        # POST + GET liste
│   ├── tutorials/[id]/       # Liste + lecteur play
│   └── page.tsx              # Accueil (formulaire)
├── components/               # Composants React réutilisables
├── lib/
│   ├── db/prisma.ts          # Client Prisma singleton
│   └── tutorials.ts          # Logique métier
├── prisma/
│   ├── schema.prisma         # Schéma de données
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
