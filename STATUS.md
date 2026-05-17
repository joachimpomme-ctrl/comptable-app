# Suivi projet — Agent IA Comptable & Patrimoine

> Snapshot d'état pour reprendre la session sans tout relire. À mettre à
> jour à la fin de chaque sprint. Dernière mise à jour : 2026-05-17.

## État global

| Phase | Statut |
|---|---|
| **Phase 0** — Scaffold Next + Auth + DB + scripts POC | ✅ livrée (code) — 🟡 setup local en cours |
| **Phase 1** — UI chat streaming + persistance + tools Claude | ⏳ pas commencée |
| **Phase 2** — Intégration Drive + templates simulations | ⏳ pas commencée |
| **Phase 3** — Audit log, dashboard usage, allowlist DB | ⏳ pas commencée |

## Setup local — checklist

Environnement de dev de Joachim sur Windows.

| Étape | Statut | Détail |
|---|---|---|
| Node 22 LTS via `fnm` | ✅ | Activé via profil PowerShell `fnm env --use-on-cd` |
| pnpm 9.15.0 via Corepack | ✅ | `Set-ExecutionPolicy CurrentUser RemoteSigned` appliqué |
| Projet hors sync cloud | ✅ | Cloné dans `C:\Users\10083287\AppData\Local\dev\comptable-app` (était sur Google Drive + Documents OneDrive, corruption `.git`) |
| `pnpm install` | ✅ | OK depuis le déplacement hors sync |
| `.env.local` créé | ✅ | depuis `.env.example` |
| Supabase projet provisionné | ✅ | ID projet `qqhgawgtjnfrhmpmxqaq`, région EU |
| Mot de passe Supabase | ✅ | **Rotaté** (l'ancien avait fuité dans le terminal — n'utilise plus celui en `.2f?FH-T2%but5e`) |
| Extension `pgcrypto` activée | ✅ | dans SQL Editor Supabase |
| `DATABASE_URL` rempli | ✅ | string Direct (port 5432) |
| `pnpm db:push` | ✅ | 12 tables + 5 enums + FKs + indexes créés (validé interactivement) |
| Clé Anthropic | ✅ | possédée, à coller dans `.env.local` (`ANTHROPIC_API_KEY`) |
| Google Cloud project | 🟡 **À FAIRE** | suite ci-dessous |
| Google OAuth client | 🟡 **À FAIRE** | suite ci-dessous |
| `AUTH_SECRET` généré | 🟡 **À FAIRE** | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ALLOWED_EMAILS` rempli | 🟡 **À FAIRE** | au moins l'email de Joachim |
| `pnpm dev` → login Google | 🟡 **À FAIRE** | validation finale Phase 0 |
| `pnpm poc` (5 cas × Sonnet+Opus) | 🟡 optionnel mais recommandé | besoin uniquement de `ANTHROPIC_API_KEY` |
| Vercel projet | ⏳ différé | Phase 1+ quand UI prête |

## Reprise demain — actions concrètes

### 1. Activer PowerShell + Node 22 dans la session

```powershell
cd C:\Users\10083287\AppData\Local\dev\comptable-app
node --version    # doit afficher v22.x.x grâce au profil fnm
pnpm --version    # doit afficher 9.15.0
```

Si fnm n'est pas auto-activé : `fnm use 22`.

### 2. Finir Google Cloud + OAuth (étapes 1-4 du guide)

Voir la dernière réponse de Claude dans le chat (sections 1 à 4). Résumé :

- Créer projet GCP `comptable-app` sur [console.cloud.google.com](https://console.cloud.google.com)
- Activer **Google Drive API**, **Google Sheets API**, **Google Docs API** dans APIs & Services → Library
- OAuth consent screen :
  - App name `Comptable App`, External, mode Testing
  - Test users : ajouter l'email Joachim
  - Scopes : `userinfo.email`, `userinfo.profile`, `openid`, `drive.file`, `spreadsheets`, `documents`
- Credentials → Create OAuth client → Web application :
  - JS origins : `http://localhost:3000`
  - Redirect URI : `http://localhost:3000/api/auth/callback/google`
- Récupérer **Client ID** + **Client Secret**

### 3. Compléter `.env.local`

```powershell
notepad .env.local
```

Champs encore vides :

```
AUTH_SECRET=         # ← node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AUTH_GOOGLE_ID=      # ← popup OAuth client GCP
AUTH_GOOGLE_SECRET=  # ← popup OAuth client GCP
ALLOWED_EMAILS=joachim@example.com   # ← email Google avec lequel tu te connectes
```

⚠️ `ALLOWED_EMAILS` doit matcher l'email présent dans **Test users** GCP, sinon `AccessDenied`.

### 4. Lancer et valider

```powershell
pnpm dev
# → http://localhost:3000 → redirige vers /login → "Se connecter avec Google"
```

Phase 0 validée quand le flow OAuth aboutit et que la home affiche email + user ID.

### 5. (Optionnel mais recommandé) Lancer le POC

Sans dépendre du reste :

```powershell
pnpm knowledge:build    # ~3s, clone le repo comptable et produit bundle.json
pnpm poc                # 10 appels Claude (Sonnet + Opus × 5 cas), ~30-60s, coût ~$1-2
```

## Décisions techniques figées

- **ORM** : Drizzle ORM + drizzle-kit (migrations versionnées dans `/drizzle/`)
- **Auth** : Auth.js v5 + Google OAuth, session strategy `database`, scopes Drive/Sheets/Docs offline
- **Source corpus** : git clone HTTPS public du repo `joachimpomme-ctrl/comptable`, concat 8 .md → `knowledge/bundle.json` (~101k tokens)
- **Stratégie corpus** : 100 % en system prompt avec `cache_control: ephemeral`, pas de RAG vector pour MVP
- **Runtime** : pnpm + Node 22 LTS, Vercel pour la prod
- **DB** : Supabase Postgres région EU, schéma 12 tables (4 Auth.js + 8 métier)

## Points ouverts à valider avec Joachim

1. **Schéma DB** — colonnes choisies au "best guess" du brief, à valider quand il y a un peu de recul. Notamment :
   - `messages.content` en `jsonb` pour blocs Anthropic (text / tool_use / tool_result)
   - `documents.folder` enum à 6 valeurs alignées Drive (`factures`, `releves_bancaires`, `analyses`, `simulations`, `documents_officiels`, `autres`)
   - `conversations.project_id` nullable pour autoriser conversations "scratch"
2. **Pricing Anthropic** dans le POC — taux Sonnet 4.6 / Opus 4.7 codés en dur dans `scripts/poc-claude-corpus.ts` (`PRICING`). À ajuster si Anthropic publie d'autres barèmes.
3. **5 cas POC** : FS-001, FS-008, FS-006, FS-019, `golden_refuse_no_source` — sont-ils représentatifs de l'usage réel ? Ajouter/remplacer si besoin.

## Phase 1 — preview

Pas avant la fin de la Phase 0 (login Google fonctionnel). Périmètre :

- UI chat streaming (Server Actions + `experimental_useObject` ou route handler avec `ReadableStream`)
- Sidebar liste des conversations, création/archivage
- Persistance messages avec compteurs tokens/coût par message
- Toggle modèle Sonnet ↔ Opus en haut de la conversation
- Tool use Claude : `search_knowledge` (grep sur les IDs de règles dans le bundle), `read_simulation`, `list_project_documents`
- System prompt construit à partir du bundle (avec `cache_control` ephemeral)
