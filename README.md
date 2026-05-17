# Agent IA Comptable & Patrimoine

Interface chat dédiée à 5–10 utilisateurs pour des questions comptables,
fiscales, financières et patrimoniales. Le corpus métier (8 fichiers
markdown ≈ 95 k tokens) est tenu dans le repo voisin
[`joachimpomme-ctrl/comptable`](https://github.com/joachimpomme-ctrl/comptable)
et injecté en system prompt côté Claude (Sonnet 4.6 par défaut, toggle
Opus 4.7) avec **prompt caching** activé.

> Cette release est la **Phase 0 — scaffold**. L'UI chat, les
> conversations persistées, l'upload de documents et les tools Drive
> arrivent en Phase 1+.

## Stack

| Couche | Choix |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind v4 + shadcn/ui (config prête, composants à ajouter) |
| Auth | Auth.js v5 + Google OAuth (scopes Drive/Sheets/Docs) + allowlist serveur |
| DB | Supabase Postgres (région EU) |
| ORM | Drizzle ORM + drizzle-kit (migrations) |
| IA | Anthropic SDK, Sonnet 4.6 / Opus 4.7, prompt caching ephemeral |
| Storage | Google Drive de l'utilisateur (scope `drive.file`) |
| Hébergement | Vercel |

## Pré-requis

- **Node.js ≥ 22** (LTS)
- **pnpm ≥ 9** (`corepack enable && corepack prepare pnpm@latest --activate`)
- **git** (le script `build-knowledge` clone le repo `comptable`)

## Setup local

### 1. Cloner et installer

```bash
git clone <ce repo>
cd comptable-app
pnpm install
```

### 2. Provisionner les services externes

**a. Supabase** (free tier OK pour le MVP)

1. Créer un projet sur [supabase.com](https://supabase.com) en **région EU** (Paris ou Frankfurt).
2. Récupérer la **Connection string** (Project Settings → Database → Connection string → URI). C'est `DATABASE_URL`.
3. Optionnel : récupérer aussi la string du **Transaction pooler** (port 6543) → `DATABASE_URL_POOLED`. Utilisée en runtime serverless ; pour les migrations on garde la connexion directe.
4. Activer l'extension `pgcrypto` si pas déjà fait (les schémas utilisent `gen_random_uuid()`) :
   ```sql
   create extension if not exists pgcrypto;
   ```

**b. Google Cloud Console**

1. Créer un projet GCP dédié (ex. `comptable-app-prod`).
2. **APIs & Services → Library** : activer
   - Google Drive API
   - Google Sheets API
   - Google Docs API
3. **OAuth consent screen** : type **External**, ajouter les scopes
   - `openid`, `email`, `profile`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/documents`
4. Ajouter chaque email de la liste blanche en **Test user** tant que l'app est en mode `Testing`.
5. **Credentials → Create credentials → OAuth client ID → Web application** :
   - **Authorized JavaScript origins** : `http://localhost:3000` (+ ton domaine Vercel pour la prod)
   - **Authorized redirect URIs** : `http://localhost:3000/api/auth/callback/google` (+ équivalent prod)
6. Récupérer `AUTH_GOOGLE_ID` et `AUTH_GOOGLE_SECRET`.

**c. Anthropic**

1. Créer une clé sur [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Vérifier que le compte a accès à Sonnet 4.6 ET Opus 4.7.

### 3. Variables d'environnement

```bash
cp .env.example .env.local
# Puis remplir :
# - ANTHROPIC_API_KEY
# - AUTH_SECRET            ($ openssl rand -base64 32)
# - AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
# - ALLOWED_EMAILS         (CSV des emails autorisés)
# - DATABASE_URL           (+ optionnel DATABASE_URL_POOLED)
```

### 4. Appliquer le schéma DB

Deux options :

```bash
# A. Pour itérer rapidement en dev (pas de fichier de migration généré)
pnpm db:push

# B. Pipeline propre avec migrations versionnées (prod)
pnpm db:generate    # produit drizzle/0000_xxx.sql
pnpm db:migrate     # applique
```

Inspecter le contenu : `pnpm db:studio`.

### 5. Construire le bundle de connaissances

Clone (ou met à jour) le repo `comptable`, concatène les 8 fichiers
`/knowledge/*.md`, écrit `knowledge/bundle.json` avec hash sha256 :

```bash
pnpm knowledge:build
```

Sortie attendue :

```
[knowledge] sections          8
[knowledge] approx tokens (~) ~95000
[knowledge] sha256            <hex>
[knowledge] written           /…/knowledge/bundle.json
```

### 6. Lancer le POC d'évaluation Claude

5 questions (issues de `08_evaluation_suite.md`) sur Sonnet ET Opus, avec
prompt caching activé sur le bloc corpus. Logue tokens / latence / coût
USD / réponse brute par appel, et un résumé par modèle.

```bash
pnpm poc
```

Le 1er appel à chaque modèle paie le **cache write** (~95 k tokens). Les
4 appels suivants doivent montrer un `cache_read` à coût réduit.

### 7. Lancer le dev server

```bash
pnpm dev
# → http://localhost:3000  (redirige vers /login si non authentifié)
```

## Scripts disponibles

| Commande | Effet |
|---|---|
| `pnpm dev` | Next.js en dev (port 3000) |
| `pnpm build` / `pnpm start` | Build prod + serve |
| `pnpm lint` / `pnpm typecheck` | Lint Next + check TypeScript |
| `pnpm db:generate` | Génère migrations SQL Drizzle |
| `pnpm db:migrate` | Applique les migrations sur `DATABASE_URL` |
| `pnpm db:push` | Synchronise le schéma sans migration (dev only) |
| `pnpm db:studio` | UI Drizzle pour inspecter la DB |
| `pnpm knowledge:build` | Produit `knowledge/bundle.json` depuis le repo `comptable` |
| `pnpm poc` | Évaluation Sonnet vs Opus sur 5 cas, avec prompt caching |

## Structure

```
app/                     # Next.js App Router
  layout.tsx
  page.tsx               # accueil — placeholder Phase 0
  login/page.tsx         # sign-in Google
  api/auth/[...nextauth] # handlers Auth.js
lib/
  auth.ts                # NextAuth config + adapter Drizzle + allowlist
  env.ts                 # validation Zod des variables d'env
  utils.ts               # cn() helper shadcn
  db/
    schema.ts            # users, projects, project_members, conversations,
                         # messages, documents, simulations, audit_log,
                         # api_usage_monthly + tables Auth.js
    index.ts             # client postgres-js + drizzle
middleware.ts            # protection des routes non publiques
scripts/
  build-knowledge.ts     # clone comptable repo → bundle.json
  poc-claude-corpus.ts   # 5 evals × 2 modèles, mesure perf + coût
drizzle.config.ts        # config drizzle-kit
.env.example             # toutes les variables documentées
```

## Roadmap

- **Phase 0 (livrée)** : scaffold Next + Auth + DB schema + scripts POC
- **Phase 1** : UI chat streaming, persistance conversations/messages, toggle modèle
- **Phase 1** : tool use Claude (`read_document`, `list_project_documents`, `search_knowledge`…)
- **Phase 2** : intégration Drive (provisioning arborescence projet, upload, lecture, création Sheets/Docs)
- **Phase 2** : templates de simulations TypeScript (schéma Zod + `compute()` déterministe + génération Google Sheet)
  - `pv_lmnp`, `comparatif_micro_reel_bnc`, `ifi`, `deficit_foncier`, `donation_simple`, `comparatif_per`, `declaration_2035_check`
- **Phase 3** : audit log, dashboard usage/coûts, allowlist gérée en DB
