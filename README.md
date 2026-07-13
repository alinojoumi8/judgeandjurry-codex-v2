# Judge & Jury v2

Hermes-backed AI courtroom simulation app with MiniMax Token Plan API as the first live LLM provider.

## What Is Implemented

- React/Vite courtroom workspace with live transcript, stage rail, role map, evidence binder, provider status, action bar, and verdict panel.
- TypeScript API server that owns trial state, evidence access, transcript events, objections, rulings, jury votes, and verdict readiness.
- Local SQLite persistence using Node's built-in `node:sqlite`.
- MiniMax Token Plan adapter for OpenAI-compatible streaming chat completions.
- Hermes-backed runtime adapter with strict mode and per-role profile endpoints, so courtroom turns can run through isolated Hermes profiles without direct MiniMax fallback.
- Hermes role profile definitions for Crown, defence, judge, clerk, evidence clerk, witness, and jury.
- Tests for MiniMax request shape, API state safety, full mock trial execution, and browser smoke coverage.

## Run

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

The API runs at `http://127.0.0.1:5174`.

## MiniMax

The app reads MiniMax Token Plan credentials from `.env`:

```powershell
MINIMAX_API_KEY=...
MINIMAX_MODEL=MiniMax-M3
MINIMAX_BASE_URL=https://api.minimax.io/v1
MINIMAX_SERVICE_TIER=standard
MINIMAX_MOCK=0
MINIMAX_DISABLED=1
```

The key is never sent to the browser. Runtime status exposes only whether a token is present.

## Hermes

The app can call Hermes OpenAI-compatible API servers. For realistic role isolation, run one Hermes profile API server per courtroom role:

```powershell
.\scripts\setup-hermes-profiles.ps1 -ApiKey "judge-jury-local-dev-key" -BasePort 8650
```

Then set the app `.env`:

```powershell
HERMES_API_KEY=judge-jury-local-dev-key
HERMES_REQUIRED=1
MINIMAX_DISABLED=1
HERMES_PROFILE_CROWN_URL=http://127.0.0.1:8650
HERMES_PROFILE_DEFENCE_URL=http://127.0.0.1:8651
HERMES_PROFILE_JUDGE_URL=http://127.0.0.1:8652
HERMES_PROFILE_CLERK_URL=http://127.0.0.1:8653
HERMES_PROFILE_EVIDENCE_CLERK_URL=http://127.0.0.1:8654
HERMES_PROFILE_WITNESS_URL=http://127.0.0.1:8655
HERMES_PROFILE_JURY_ORCHESTRATOR_URL=http://127.0.0.1:8656
```

With `HERMES_REQUIRED=1` or `MINIMAX_DISABLED=1`, a missing or failing Hermes role endpoint fails the trial instead of silently falling back to direct MiniMax.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:ui
```

`npm run test:ui` starts the API and client in `MINIMAX_MOCK=1`, creates a matter, starts a trial, and verifies the browser courtroom loads.

## Disclaimer

This is decision-support and training software only. It is not legal advice and does not produce binding court outcomes.
