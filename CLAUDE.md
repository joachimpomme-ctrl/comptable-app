@AGENTS.md

# Compta Multi-Agents — Project Notes

## Architecture
Multi-agents orchestrator built on Next.js 16 + Vercel AI SDK + Gemini.
Refer to `/Projet_Compta_Multi_Agents.html` (project root) for the full architecture document.

## Stack
- **Next.js 16** (App Router, Turbopack, RSC streaming)
- **@google/genai** for direct Gemini API access (context caching)
- **@ai-sdk/google** + **ai** for streaming UI
- **googleapis** for Sheets persistence

## Models
- `GEMINI_MODEL_FAST` (default `gemini-2.5-flash`) — Orchestrator + Gem clone
- `GEMINI_MODEL_PRO` (default `gemini-2.5-pro`) — Reviewer
- Update to `gemini-3.5-*` when available in the API region.

## Knowledge base
The Gem KB lives at `../../PARTAGE/knowledge/` (relative to this app).
It is loaded once at boot and pushed to Gemini's explicit context cache.

## Google Drive caveat
The project sits inside a Google Drive folder. We initially symlinked
`node_modules` outside Drive but **Turbopack 8 (Next 16) refuses symlinks
crossing the project root**, so `node_modules` is now kept in Drive.

Google Drive in "Stream files" mode (default on macOS Sonoma+) hydrates
files on demand, which keeps the local footprint small. If sync becomes
noisy, mark `App/comptable-app/node_modules` as "Available offline only"
in Drive preferences.

## Test fixtures
12 LMNP cases extracted from `08_evaluation_suite.md` are stored in
`tests/lmnp-cases.json`. The test runner compares baseline (Gem alone)
vs ecosystem (full pipeline) and reports the 6 target metrics.
