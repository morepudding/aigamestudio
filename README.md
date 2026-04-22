## Eden Studio

Plateforme Next.js de gestion de studio de jeux avec pipeline agentique, Supabase, GitHub et planification assistée par CrewAI.

## Installation locale

1. Installe les dépendances avec `npm install`.
2. Crée ou complète `.env.local` à la racine du projet.
3. Lance `npm run dev`.

## Variables d'environnement

Variables minimales pour le projet :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_TOKEN`
- `OPENROUTER_API_KEY` ou `OPEN_ROUTE_SERVICE_API_KEY`
- `NEXT_PUBLIC_APP_URL`

Variables pour activer le planner CrewAI backlog -> waves :

- `USE_CREWAI_BACKLOG_PLANNER=true`
- `CREWAI_ORCHESTRATOR_URL=http://127.0.0.1:8000`

Quand `USE_CREWAI_BACKLOG_PLANNER` est actif, `generateDevWaves` envoie le backlog, le GDD et les specs au microservice CrewAI via `POST /plan-backlog`. En cas d'erreur, l'application bascule automatiquement sur la génération LLM actuelle et persiste un planning run avec `fallback_used=true`.

## UI pipeline CrewAI

La vue projet en développement affiche désormais :

- un bloc `Planification IA` avec source, durée, tokens, warnings et fallback
- l'objectif CrewAI sur chaque wave
- la provenance CrewAI, la justification courte et les `context_files` sur chaque tâche quand le run normalisé est disponible

## Commandes utiles

```bash
npm run dev
npm run build
npm run lint
```
