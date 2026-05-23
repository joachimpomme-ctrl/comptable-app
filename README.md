# Compta Multi-Agents

Écosystème de spécialistes orbitant autour du Gem comptable existant — Orchestrateur, Gem cloné, Calculateur, Reviewer, Quality Gate.

Voir `../../Projet_Compta_Multi_Agents.html` à la racine du projet pour la documentation complète.

## Setup

```bash
cp .env.local.example .env.local
# Renseigner GEMINI_API_KEY (https://aistudio.google.com/apikey)
# Optionnel : SHEETS_ID + SHEETS_SERVICE_ACCOUNT_B64 pour la persistance
npm install
```

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Lance le serveur de dev (Turbopack) sur http://localhost:3000 |
| `npm run build` | Build production |
| `npm test` | Tests unitaires (vitest) — calculateur + quality gate |
| `npm run test:lmnp` | Test runner LMNP (12 cas, baseline vs écosystème) — **requiert le dev server lancé** |

## Routes

| Route | Description |
|---|---|
| `/` | Landing page — présentation de l'écosystème |
| `/ask` | UI interactive — input question + trace latérale streaming |
| `POST /api/gem` | Endpoint baseline : Gem cloné seul (KB cachée), sans orchestration |
| `POST /api/ask` | Pipeline complet — Orchestrateur → Gem → Calculateur → Reviewer → Quality Gate. Stream NDJSON. |

## Architecture du code

```
app/
  api/ask/route.ts          # Pipeline complet (NDJSON stream)
  api/gem/route.ts          # Gem cloné seul (baseline)
  ask/page.tsx              # Page UI (server component)
  ask/ask-client.tsx        # Composant client interactif
  page.tsx                  # Landing page
  layout.tsx                # Root layout

lib/
  agents/
    orchestrator.ts         # Gemini Flash + JSON mode
    gem-clone.ts            # Gemini Flash + KB cachée
    param-extractor.ts      # Extrait Form002Params depuis question libre
    reviewer.ts             # Gemini Pro audit
    calculator/
      form-001.ts           # Amort art. 39-C
      form-002.ts           # PV LMNP 2025
      abattements.ts        # Abat. durée IR/PS + taxe sup.
  kb/
    loader.ts               # Charge les 10 fichiers KB
    cache-manager.ts        # Gestion du context cache Gemini
    indexes.ts              # Lookup CGI / crosswalk pour Quality Gate
  sheets/
    logger.ts               # Persistance Google Sheets
  quality-gate.ts           # Vérifications déterministes
  pipeline.ts               # Orchestration des agents
  gemini-client.ts          # Singleton @google/genai
  env.ts                    # Accès lazy aux env vars
  types.ts                  # Types partagés

tests/
  calculator.test.ts        # Tests unitaires des formules (vitest)
  quality-gate.test.ts      # Tests unitaires du QG
  lmnp-cases.json           # 12 cas LMNP de test
  runner-lmnp.ts            # Runner baseline vs écosystème
```

## Configuration Sheets (optionnel)

1. Créer un Google Sheets vide.
2. Onglet `Historique_Compta` (sera créé/peuplé automatiquement).
3. Créer un service account sur Google Cloud Console (rôle « Sheets API »).
4. Partager le Sheets avec l'email du service account (en éditeur).
5. Encoder le JSON du service account en base64 :
   ```bash
   base64 < service-account.json | tr -d '\n' | pbcopy
   ```
6. Coller dans `.env.local` :
   ```
   SHEETS_ID=<id_dans_url_du_sheets>
   SHEETS_SERVICE_ACCOUNT_B64=<base64>
   ```

Sans Sheets configuré, le logger écrit en console (pas de crash).

## Métriques cibles du MVP

| Métrique | Cible vs baseline (Gem seul) |
|---|---|
| Citations CGI valides | +5 pts |
| Erreurs arithmétiques | ÷ 5 |
| Omission de millésime | ÷ 3 |
| Latence p50 (simples) | < 1.5× |
| Latence p50 (complexes) | < 3× |
| Coût €/requête | < 2.5× |

Mesurées par `npm run test:lmnp` sur les 12 cas de `tests/lmnp-cases.json`.
