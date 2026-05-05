# QuizDog Refactoring Phase 2 Game Flow Services

## Scope

This phase moves repeated game-flow data access behind focused services and removes full-page navigation in the main play path.

## Added Service Boundaries

- `lib/services/questions.ts`
  - Loads public game questions without exposing real answers.
  - Normalizes JSON `options` into `string[]`.
  - Checks answers through the existing `check_question_answer` RPC.
  - Provides shared question shuffling for modes that need random order.

- `lib/services/players.ts`
  - Reads a fresh player by id.
  - Updates one player or all players in a room.
  - Keeps mode pages from hand-writing repeated `players.update(...).eq(...)` calls.

- `lib/services/errors.ts`
  - Formats Supabase/PostgREST-style errors consistently.

## Connected Flows

- `useGameBase` now delegates question loading, answer checking, answer-history syncing, and room finishing to services.
- Factory mode now uses the shared question service and answer RPC service.
- Racing, Fishing, All-In, Pool, and Gold Quest now use player service helpers for repeated player state writes or fresh player reads.
- Lobby, direct play links, factory redirects, and game-mode mismatch redirects now use Next router navigation instead of `window.location.href`.

## Remaining UX Debt

- Many teacher/admin flows still use `alert()` and `confirm()`.
- A future phase should add a lightweight app-level feedback layer:
  - `toast` for success/error notices.
  - `confirm dialog` for destructive actions.
  - inline form validation for teacher creation/edit flows.

## Remaining Game Logic Debt

- Tower and Don't Look Down still contain large page-level state machines.
- Gold Quest reward application still accepts a Supabase client directly in `applyBoxEvent`; this should become a domain service.
- Several game modes still keep mode-specific score math inside page components. The next phase should move those into `lib/game/*` or `lib/services/gameStates.ts`.
